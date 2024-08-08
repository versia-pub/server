{
  description = "JavaScript example flake for Zero to Nix";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-compat.url = "https://flakehub.com/f/edolstra/flake-compat/1.tar.gz";
  };

  outputs = { self, nixpkgs, flake-compat }:
    let
      # Systems supported
      allSystems = [
        "x86_64-linux" # 64-bit Intel/AMD Linux
        "aarch64-linux" # 64-bit ARM Linux
        "x86_64-darwin" # 64-bit Intel macOS
        "aarch64-darwin" # 64-bit ARM macOS
      ];

      # Helper to provide system-specific attributes
      forAllSystems = f: nixpkgs.lib.genAttrs allSystems (system: f {
        pkgs = import nixpkgs { inherit system; };
      });
    in
    {
      packages = forAllSystems ({ pkgs }: {
        default = let 
          pin = pkgs.lib.importJSON ./pin.json;
          src = self;
          node_modules = pkgs.stdenv.mkDerivation {
            pname = "versiajs-node_modules";
            inherit src;
            version = pin.version;
            impureEnvVars = pkgs.lib.fetchers.proxyImpureEnvVars
              ++ [ "GIT_PROXY_COMMAND" "SOCKS_SERVER" ];
            nativeBuildInputs = with pkgs; [ bun nodejs nodePackages.typescript nodePackages.typescript-language-server ];
            buildInputs = with pkgs; [ libstdcxx5 ];
            dontConfigure = true;
            buildPhase = ''
              bun install --production --frozen-lockfile --ignore-scripts
            '';
            installPhase = ''
              mkdir -p $out/node_modules
              cp -R ./node_modules $out
            '';
            outputHash = pin."${pkgs.stdenv.system}";
            outputHashAlgo = "sha256";
            outputHashMode = "recursive";
            dontFixup = true;
          };
        in pkgs.stdenv.mkDerivation {
          name = "versiajs";
          version = pin.version;

          buildPhase = ''
            runHook preBuild

            ln -s ${node_modules}/node_modules .
            bun run build

            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p $out/bin
            cp -R ./* $out
            makeBinaryWrapper ${pkgs.bun}/bin/bun $out/bin/versiajs \
              --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.bun ]} \
              --add-flags "run --prefer-offline --no-install --cwd $out ./cli/index.ts start"

            runHook postInstall
          '';
          
          buildInputs = with pkgs; [
            nodejs
          ];

          nativeBuildInputs = with pkgs; [ makeBinaryWrapper bun ];

          inherit src;

          dontConfigure = true;
        };
      });
      devShells = forAllSystems ({ pkgs }: {
        default = pkgs.mkShell {
          buildInputs = with pkgs; [
            bun
            nodejs
            nodePackages.typescript
            nodePackages.typescript-language-server
            nix-ld
          ];
        };
      });
    };
}
