{
  description = "Versia Server";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
    ...
  }:
    {
      overlays.default = final: prev: rec {
        versia-server =
          final.callPackage ./nix/package.nix {
          };
        versia-server-worker = final.callPackage ./nix/package-worker.nix {
          inherit versia-server;
        };
      };

      nixosModules = rec {
        versia-server = import ./nix/module.nix;
        default = versia-server;
      };
    }
    // flake-utils.lib.eachSystem ["x86_64-linux" "aarch64-linux"] (system: let
      pkgs = import nixpkgs {
        inherit system;
        overlays = [self.overlays.default];
      };
    in {
      packages = {
        inherit (pkgs) versia-server versia-server-worker;
      };
    })
    // flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {
        inherit system;
        overlays = [self.overlays.default];
      };
    in {
      devShells = {
        default = pkgs.mkShell rec {
          libPath = with pkgs;
            lib.makeLibraryPath [
              stdenv.cc.cc.lib
            ];

          LD_LIBRARY_PATH = "${libPath}";

          buildInputs = with pkgs; [
            bun
            vips
            nodePackages.typescript
            nodePackages.typescript-language-server
            nix-ld
          ];
        };
      };
    });
}
