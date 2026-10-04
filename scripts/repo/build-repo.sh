#!/usr/bin/env bash
# Builds a single served tree containing an APT repo, a DNF repo and a pacman repo.
# Each index is produced by that distribution's own generator rather than
# hand-rolled here, so the formats stay canonical.
#
# usage: build-repo.sh <dist-dir> <out-dir> <origin> [gpg-key-id]
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

missing=""
case " $FORMATS " in *" apt "*)  command -v apt-ftparchive >/dev/null 2>&1 || missing="$missing apt-utils(apt-ftparchive)" ;; esac
case " $FORMATS " in *" rpm "*)  { command -v createrepo_c >/dev/null 2>&1 || command -v createrepo >/dev/null 2>&1; } || missing="$missing createrepo-c" ;; esac
case " $FORMATS " in *" pacman "*) command -v repo-add >/dev/null 2>&1 || missing="$missing pacman(pacman-package-manager)" ;; esac
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

DEB_SRC="$(find "$DIST_DIR" -maxdepth 1 -name '*.deb' | sort | head -1)"
RPM_SRC="$(find "$DIST_DIR" -maxdepth 1 -name '*.rpm' | sort | head -1)"
PAC_SRC="$(find "$DIST_DIR" -maxdepth 1 -name '*.pacman' | sort | head -1)"

[ -n "$DEB_SRC" ] || { echo "build-repo: no .deb in $DIST_DIR" >&2; exit 1; }
[ -n "$RPM_SRC" ] || { echo "build-repo: no .rpm in $DIST_DIR" >&2; exit 1; }
[ -n "$PAC_SRC" ] || { echo "build-repo: no .pacman in $DIST_DIR" >&2; exit 1; }

# electron-builder names these deterministically from package.json:
#   <name>_<version>_<arch>.deb
# so the identity can be read without dpkg-deb, which is absent on build hosts
# that are not themselves Debian.
DEB_STEM="$(basename "$DEB_SRC" .deb)"
PKG_NAME="${DEB_STEM%%_*}"
ARCH="${DEB_STEM##*_}"
VERSION="${DEB_STEM#*_}"
VERSION="${VERSION%_$ARCH}"

SUITE=stable
COMPONENT=main
POOL_REL="pool/$COMPONENT/o/$PKG_NAME"

GPG_ARGS=(--batch --yes --pinentry-mode loopback --digest-algo SHA512)
[ -n "$GPG_KEY" ] && GPG_ARGS+=(--local-user "$GPG_KEY")

sign_detached() {
  gpg "${GPG_ARGS[@]}" --armor --detach-sign -o "$1.asc" "$1"
}

echo "==> $PKG_NAME $VERSION ($ARCH)"

# ----------------------------------------------------------------- APT
# Everything under $APT_ROOT is served as the apt suite root, so a source line
# of ".../apt stable main" resolves Filename paths that are relative to $APT_ROOT.
if [[ " $FORMATS " == *" apt "* ]]; then
echo "==> apt"
mkdir -p "$APT_ROOT/$POOL_REL" "$APT_ROOT/dists/$SUITE/$COMPONENT/binary-$ARCH"
cp "$DEB_SRC" "$APT_ROOT/$POOL_REL/"

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
  sign_detached "$APT_ROOT/dists/$SUITE/Release"
fi
fi

# ----------------------------------------------------------------- DNF
if [[ " $FORMATS " == *" rpm "* ]]; then
echo "==> rpm"
mkdir -p "$RPM_ROOT"
cp "$RPM_SRC" "$RPM_ROOT/"
if command -v createrepo_c >/dev/null 2>&1; then
  createrepo_c --quiet --general-compress-type gz --changelog-limit 0 --update "$RPM_ROOT"
else
  createrepo --quiet --changelog-limit 0 --update "$RPM_ROOT"
fi
[ -n "$GPG_KEY" ] && sign_detached "$RPM_ROOT/repodata/repomd.xml"
fi

# ----------------------------------------------------------------- pacman
if [[ " $FORMATS " == *" pacman "* ]]; then
echo "==> pacman"
# fpm emits "<name>-<version>.pacman", but libalpm's alpm_pkg_vercompute() does
# strstr(..., ".pkg.tar") on the pool filename and rejects anything else, so the
# file has to be republished under the name pacman expects. The payload is an
# xz-compressed tar, hence .pkg.tar.xz rather than .pkg.tar.zst.
PAC_PKGVER="$(bsdtar -xOf "$PAC_SRC" .PKGINFO | sed -n 's/^pkgver = //p' | head -1)"
PAC_ARCH="$(bsdtar -xOf "$PAC_SRC" .PKGINFO | sed -n 's/^arch = //p' | head -1)"
PAC_POOL="$PAC_ROOT/${PKG_NAME}-${PAC_PKGVER}-${PAC_ARCH}.pkg.tar.xz"
cp "$PAC_SRC" "$PAC_POOL"

if [ -n "$GPG_KEY" ]; then
  repo-add --quiet --sign --key "$GPG_KEY" "$PAC_ROOT/$PKG_NAME.db.tar.gz" "$PAC_POOL"
else
  repo-add --quiet "$PAC_ROOT/$PKG_NAME.db.tar.gz" "$PAC_POOL"
fi

# repo-add leaves <name>.db as a symlink to the .tar.gz. GitHub Pages does not
# reliably resolve symlinks, so materialise a real copy; libalpm sniffs the
# gzip stream from the content and does not care that it is not a link.
rm -f "$PAC_ROOT/$PKG_NAME.db"
cp "$PAC_ROOT/$PKG_NAME.db.tar.gz" "$PAC_ROOT/$PKG_NAME.db"
fi

echo "==> wrote $OUT_DIR (formats: $FORMATS)"
