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
      in
      {
        packages.default = pkgs.buildNpmPackage rec {
          pname = "openanime";
          version = "1.1.6";

          src = ./.;

          npmDepsHash = "sha256-TeQXMtVFjIQHs5FDrqfyLs9z5Jix2ZJhyapnLNKZIcg=";

          # Runtime only needs @xhayper/discord-rpc — electron and
          # electron-builder are devDependencies for the AppImage/deb/rpm
          # build path, not needed here since this derivation uses nixpkgs'
          # own electron instead of bundling one.
          npmInstallFlags = [ "--omit=dev" ];
          dontNpmBuild = true;

          nativeBuildInputs = [ pkgs.makeWrapper ];

          installPhase = ''
            runHook preInstall

            mkdir -p $out/share/openanime $out/bin
            cp -r launcher.js main.js preload.js icon512.png package.json node_modules $out/share/openanime/

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
            StartupWMClass=OpenAnime
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
