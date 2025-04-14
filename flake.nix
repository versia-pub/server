{
  description = "Versia Server";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";

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
        versia-server = final.callPackage ./nix/package.nix {};
        versia-server-worker = final.callPackage ./nix/package-worker.nix {
          inherit versia-server;
        };
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
        default = self.packages.${system}.versia-server;
      };
    });
}
