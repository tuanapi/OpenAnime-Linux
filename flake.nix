{
  description = "OpenAnime Linux — unofficial WebGPU/Vulkan client for openani.me";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # The npm build bundles the electron in devDependencies (44.5.1). This
        # derivation wraps nixpkgs' electron instead, so the two channels do not
        # ship the same Electron major. nixpkgs does not carry Electron 44 at
        # all (43.6.0 on unstable, 43.7.7 on master as of this writing), so the
        # lock cannot be bumped to close the gap -- matching 44.5.1 would mean
        # fetching the GitHub release zip as a fixed-output derivation.
        # installPhase warns on every build so the gap stays visible.
        lockedElectron = (builtins.fromJSON (builtins.readFile ./package-lock.json)).packages."node_modules/electron".version;
        nixElectron = pkgs.electron.version;
      in
      {
        packages.default = pkgs.buildNpmPackage rec {
          pname = "openanime";
          version = "1.1.9";

          src = ./.;

          # Covers package-lock.json, so a version bump alone changes it. Refresh
          # with:
          #   nix run "github:NixOS/nixpkgs/$(python3 -c "import json;print(json.load(open('flake.lock'))['nodes']['nixpkgs']['locked']['rev'])")#prefetch-npm-deps" -- package-lock.json
          # Use the locked revision above, not nixpkgs-unstable: the channel
          # moves daily and yields a different hash for the same lockfile.
          npmDepsHash = "sha256-orxbHbGOKkIZUq9hxRGAYqvEVrgrDvQyQPoWrZcqJuE=";

          # Runtime only needs @xhayper/discord-rpc — electron and
          # electron-builder are devDependencies for the AppImage/deb/rpm
          # build path, not needed here since this derivation uses nixpkgs'
          # own electron instead of bundling one.
          npmInstallFlags = [ "--omit=dev" ];
          dontNpmBuild = true;

          nativeBuildInputs = [ pkgs.makeWrapper ];

          installPhase = ''
            runHook preInstall

            if [ "${nixElectron}" != "${lockedElectron}" ]; then
              echo "warning: this Nix build wraps Electron ${nixElectron}," >&2
              echo "warning: but package-lock.json pins ${lockedElectron}." >&2
              echo "warning: nixpkgs has no Electron 44; re-check when bumping the lock." >&2
            fi

            mkdir -p $out/share/openanime $out/bin
            cp -r launcher.js main.js preload.js injected.js scripts icon512.png package.json node_modules $out/share/openanime/

            makeWrapper ${pkgs.electron}/bin/electron $out/bin/openanime \
              --add-flags $out/share/openanime/launcher.js

            install -Dm644 icon512.png $out/share/icons/hicolor/512x512/apps/openanime.png

            mkdir -p $out/share/applications
            cat > $out/share/applications/openanime.desktop <<EOF
            [Desktop Entry]
            Version=1.0
            Type=Application
            Name=OpenAnime
            Comment=WebGPU destekli anime izleme uygulaması
            Exec=openanime %u
            Icon=openanime
            Terminal=false
            Categories=AudioVideo;Video;Player;
            StartupWMClass=openanime
            PrefersNonDefaultGPU=true
            EOF

            runHook postInstall
          '';

          meta = with pkgs.lib; {
            description = "Unofficial OpenAnime Linux client (WebGPU/Vulkan)";
            homepage = "https://github.com/tuanapi/OpenAnime-Linux";
            license = licenses.mit;
            platforms = platforms.linux;
            mainProgram = "openanime";
          };

          passthru = {
            inherit lockedElectron nixElectron;
            electronMatchesNpm = nixElectron == lockedElectron;
          };
        };

        apps.default = flake-utils.lib.mkApp {
          drv = self.packages.${system}.default;
          name = "openanime";
        };

        devShells.default = pkgs.mkShell {
          packages = [ pkgs.nodejs_22 pkgs.electron ];
        };
      });
}
