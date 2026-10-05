#!/usr/bin/env bash
# Builds a single served tree containing an APT repo, a DNF repo and a pacman repo.
# Each index is produced by that distribution's own generator rather than
# hand-rolled here, so the formats stay canonical.
#
# usage: build-repo.sh <dist-dir> <out-dir> <origin> [gpg-key-id] [seed-dir]
#
# seed-dir, when given, is a flat directory of packages already published to
# gh-pages. They are merged into the pool before any index is generated, so the
# generated metadata actually references them. Merging them in afterwards would
# leave them in the pool but absent from Packages/repomd.xml/pacman db, i.e.
# files a client can see but can never install.
#
# FORMATS is a space separated subset of "apt rpm pacman"; it defaults to all
# three. Restricting it is only useful on a host that lacks some of the index
# generators, e.g. generating just the pacman repo from a non-Arch machine.
set -euo pipefail

DIST_DIR="${1:?missing dist dir}"
OUT_DIR="${2:?missing out dir}"
ORIGIN="${3:?missing origin label}"
GPG_KEY="${4:-}"
FORMATS="${FORMATS:-apt rpm pacman}"
SEED_DIR="${5:-}"

missing=""
case " $FORMATS " in *" apt "*)  command -v apt-ftparchive >/dev/null 2>&1 || missing="$missing apt-utils(apt-ftparchive)" ;; esac
case " $FORMATS " in *" rpm "*)  { command -v createrepo_c >/dev/null 2>&1 || command -v createrepo >/dev/null 2>&1; } || missing="$missing createrepo-c" ;; esac
case " $FORMATS " in *" pacman "*) { command -v repo-add >/dev/null 2>&1 && command -v bsdtar >/dev/null 2>&1; } || missing="$missing pacman(pacman-package-manager bsdtar)" ;; esac
if [ -n "$missing" ]; then
  echo "build-repo: missing index generators:$missing" >&2
  echo "  debian/ubuntu: apt-get install -y apt-utils createrepo-c pacman-package-manager" >&2
  exit 1
fi

APT_ROOT="$OUT_DIR/apt"
RPM_ROOT="$OUT_DIR/rpm"
PAC_ROOT="$OUT_DIR/pacman"

rm -rf "$OUT_DIR"
mkdir -p "$APT_ROOT" "$RPM_ROOT" "$PAC_ROOT"

# The apt block cd's into $APT_ROOT before running apt-ftparchive, so any path
# still relative at that point would resolve against the wrong root. Pin the
# output root to an absolute path now that it exists.
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
APT_ROOT="$OUT_DIR/apt"
RPM_ROOT="$OUT_DIR/rpm"
PAC_ROOT="$OUT_DIR/pacman"

# Version sort, newest last. Plain sort ranks 1.1.10 below 1.1.9, so `sort |
# head -1` would silently pick the wrong package as soon as the version number
# reaches two digits.
DEB_SRC="$(find "$DIST_DIR" -maxdepth 1 -name '*.deb' | sort -V | tail -1)"
RPM_SRC="$(find "$DIST_DIR" -maxdepth 1 -name '*.rpm' | sort -V | tail -1)"
PAC_SRC="$(find "$DIST_DIR" -maxdepth 1 -name '*.pacman' | sort -V | tail -1)"

[ -n "$DEB_SRC" ] || { echo "build-repo: no .deb in $DIST_DIR" >&2; exit 1; }
[ -n "$RPM_SRC" ] || { echo "build-repo: no .rpm in $DIST_DIR" >&2; exit 1; }
[ -n "$PAC_SRC" ] || { echo "build-repo: no .pacman in $DIST_DIR" >&2; exit 1; }

# Pool contents: the freshly built package plus whatever the seed dir carries,
# de-duplicated by filename with the fresh build winning. Re-publishing a
# version that is already in the pool must replace it, not sit beside it.
pool_list() { # <fresh-pkg> <glob>
  { [ -n "$1" ] && echo "$1"
    [ -n "$SEED_DIR" ] && find "$SEED_DIR" -maxdepth 1 -name "$2"
  } | awk -F/ 'NF && !seen[$NF]++'
}

APT_DEBS=(); while IFS= read -r f; do APT_DEBS+=("$f"); done < <(pool_list "$DEB_SRC" '*.deb')
RPM_PKGS=(); while IFS= read -r f; do RPM_PKGS+=("$f"); done < <(pool_list "$RPM_SRC" '*.rpm')
PAC_SEEDS=(); while IFS= read -r f; do PAC_SEEDS+=("$f"); done < <(pool_list "$PAC_SRC" '*.pacman')

# electron-builder names these deterministically from package.json:
#   <name>_<version>_<arch>.deb
# so the identity can be read without dpkg-deb, which is absent on build hosts
# that are not themselves Debian.
DEB_STEM="$(basename "$DEB_SRC" .deb)"
PKG_NAME="${DEB_STEM%%_*}"
ARCH="${DEB_STEM##*_}"
VERSION="${DEB_STEM#*_}"
VERSION="${VERSION%_"$ARCH"}"

SUITE=stable
COMPONENT=main
POOL_REL="pool/$COMPONENT/o/$PKG_NAME"

GPG_ARGS=(--batch --yes --pinentry-mode loopback --digest-algo SHA512)
[ -n "$GPG_KEY" ] && GPG_ARGS+=(--local-user "$GPG_KEY")

sign_detached() {
  # Output path is an explicit argument, because the two consumers want
  # different names for the same operation: apt looks for Release.gpg and has no
  # notion of Release.asc, while dnf's repo_gpgcheck wants repomd.xml.asc.
  #
  # ASCII-armored, and that is not cosmetic. A binary detached signature is
  # rejected by apt with "unsupported binary format": the signature packet here
  # is ~117 bytes, which the OpenPGP framing rules force into the old-format
  # header, and apt will not parse that for a detached signature. Armored is
  # accepted by every apt version and costs a couple of hundred bytes.
  gpg "${GPG_ARGS[@]}" --armor --detach-sign -o "$1" "$2"
}

echo "==> $PKG_NAME $VERSION ($ARCH)"

# ----------------------------------------------------------------- APT
# Everything under $APT_ROOT is served as the apt suite root, so a source line
# of ".../apt stable main" resolves Filename paths that are relative to $APT_ROOT.
if [[ " $FORMATS " == *" apt "* ]]; then
echo "==> apt"
mkdir -p "$APT_ROOT/$POOL_REL" "$APT_ROOT/dists/$SUITE/$COMPONENT/binary-$ARCH"
for deb in "${APT_DEBS[@]}"; do cp "$deb" "$APT_ROOT/$POOL_REL/"; done

# Run from $APT_ROOT with the pool as the search path: apt-ftparchive then emits
# "Filename: pool/main/o/openanime/<file>", which is exactly the relative path
# apt resolves against the suite root.
BIN_DIR="$APT_ROOT/dists/$SUITE/$COMPONENT/binary-$ARCH"
( cd "$APT_ROOT" && apt-ftparchive --arch "$ARCH" packages pool > "$BIN_DIR/Packages" )

gzip -9nkf "$BIN_DIR/Packages"
if command -v zstd >/dev/null 2>&1; then
  zstd -q -f -19 -o "$BIN_DIR/Packages.zst" "$BIN_DIR/Packages"
fi

apt-ftparchive \
  -o APT::FTPArchive::Release::Origin="$ORIGIN" \
  -o APT::FTPArchive::Release::Label="$ORIGIN" \
  -o APT::FTPArchive::Release::Suite="$SUITE" \
  -o APT::FTPArchive::Release::Codename="$SUITE" \
  -o APT::FTPArchive::Release::Architectures="$ARCH" \
  -o APT::FTPArchive::Release::Components="$COMPONENT" \
  -o APT::FTPArchive::Release::Description="$ORIGIN repository" \
  release "$APT_ROOT/dists/$SUITE" > "$APT_ROOT/dists/$SUITE/Release"

if [ -n "$GPG_KEY" ]; then
  gpg "${GPG_ARGS[@]}" --clearsign -o "$APT_ROOT/dists/$SUITE/InRelease" "$APT_ROOT/dists/$SUITE/Release"
  sign_detached "$APT_ROOT/dists/$SUITE/Release.gpg" "$APT_ROOT/dists/$SUITE/Release"
fi
fi

# ----------------------------------------------------------------- DNF
if [[ " $FORMATS " == *" rpm "* ]]; then
echo "==> rpm"
mkdir -p "$RPM_ROOT"
for rpm_pkg in "${RPM_PKGS[@]}"; do cp "$rpm_pkg" "$RPM_ROOT/"; done
if command -v createrepo_c >/dev/null 2>&1; then
  createrepo_c --quiet --general-compress-type gz --changelog-limit 0 --update "$RPM_ROOT"
else
  createrepo --quiet --changelog-limit 0 --update "$RPM_ROOT"
fi
[ -n "$GPG_KEY" ] && sign_detached "$RPM_ROOT/repodata/repomd.xml.asc" "$RPM_ROOT/repodata/repomd.xml"
fi

# ----------------------------------------------------------------- pacman
if [[ " $FORMATS " == *" pacman "* ]]; then
echo "==> pacman"
# fpm emits "<name>-<version>.pacman", but libalpm's alpm_pkg_vercompute() does
# strstr(..., ".pkg.tar") on the pool filename and rejects anything else, so the
# file has to be republished under the name pacman expects. The payload is an
# xz-compressed tar, hence .pkg.tar.xz rather than .pkg.tar.zst. The version is
# read per package rather than once, because a seeded pool holds more than one.
#
# repo-add keeps only the newest version of a given package name, so it is fed
# oldest first: handed newest first it discards each older package with an
# "a newer version is already present in database" warning. The result is the
# same either way, but the warning reads like a failure in CI output.
PAC_SEEDS_SORTED=()
while IFS= read -r f; do PAC_SEEDS_SORTED+=("$f"); done < <(
  for pac_src in "${PAC_SEEDS[@]}"; do
    pac_ver="$(bsdtar -xOf "$pac_src" .PKGINFO | sed -n 's/^pkgver = //p' | head -1)"
    printf '%s\t%s\n' "$pac_ver" "$pac_src"
  done | sort -V | cut -f2-
)

PAC_POOL_FILES=()
for pac_src in "${PAC_SEEDS_SORTED[@]}"; do
  pac_pkgver="$(bsdtar -xOf "$pac_src" .PKGINFO | sed -n 's/^pkgver = //p' | head -1)"
  pac_arch="$(bsdtar -xOf "$pac_src" .PKGINFO | sed -n 's/^arch = //p' | head -1)"
  pac_pool="$PAC_ROOT/${PKG_NAME}-${pac_pkgver}-${pac_arch}.pkg.tar.xz"
  cp "$pac_src" "$pac_pool"
  PAC_POOL_FILES+=("$pac_pool")

  if [ -n "$GPG_KEY" ]; then
    # Arch's own repos ship a detached .sig beside every package, and libalpm treats
    # a missing one as fatal under "SigLevel = Required". Sign the pool file the
    # same way, binary rather than armored to match what pacman expects.
    gpg "${GPG_ARGS[@]}" --detach-sign -o "$pac_pool.sig" "$pac_pool"
  fi
done

# Deliberately no --sign or --include-sigs here. --include-sigs only exists from
# pacman 6.1, and older repo-add parses an unrecognised flag as a positional
# database filename and aborts with "does not have a valid database archive
# extension". Signing the databases directly with gpg keeps this working on the
# older repo-add that Ubuntu's pacman-package-manager ships, and keeps full
# control of the gpg invocation.
repo-add --quiet "$PAC_ROOT/$PKG_NAME.db.tar.gz" "${PAC_POOL_FILES[@]}"

# repo-add names the database file after the extension it was handed, so the
# archive extension that turns up here depends on how the local repo-add was
# built; Ubuntu's pacman-package-manager and Arch's own pacman do not agree.
# Discover what was actually written instead of assuming .tar.gz.
#
# repo-add also leaves <name>.db as a symlink pointing at that archive. Pages
# will not serve a symlink, so replace each one with a real copy of the same
# bytes. A detached signature covers content and not filenames, so the copy
# still verifies, and libalpm sniffs the compression from the payload.
for stem in "$PKG_NAME.db" "$PKG_NAME.files"; do
  for db in "$PAC_ROOT/$stem".tar.*; do
    [ -f "$db" ] || continue
    if [ -n "$GPG_KEY" ]; then
      rm -f "$db.sig"
      gpg "${GPG_ARGS[@]}" --detach-sign -o "$db.sig" "$db"
    fi
    rm -f "$PAC_ROOT/$stem" "$PAC_ROOT/$stem.sig"
    cp "$db" "$PAC_ROOT/$stem"
    if [ -f "$db.sig" ]; then
      cp "$db.sig" "$PAC_ROOT/$stem.sig"
    fi
  done
done
fi

echo "==> wrote $OUT_DIR (formats: $FORMATS)"
