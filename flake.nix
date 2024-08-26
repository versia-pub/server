{
  description = "Versia Server";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-compat.url = "https://flakehub.com/f/edolstra/flake-compat/1.tar.gz";
    flake-utils.url = "github:numtide/flake-utils";
  };

  nixConfig = {
    extra-substituters = [
      "https://cache.kyouma.net"
    ];
    extra-trusted-public-keys = [
      "cache.kyouma.net:Frjwu4q1rnwE/MnSTmX9yx86GNA/z3p/oElGvucLiZg="
    ];
  };

  outputs = { self, nixpkgs, flake-utils, ... }: {
    hydraJobs = {
      inherit (self) packages;
    };
    overlays.default = final: prev: {
      versiajs = final.callPackage ./nix/package.nix {};
    };
  } //
  flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" ] (system: let
    pkgs = import nixpkgs {
      inherit system;
      overlays = [ self.overlays.default ];
    };
  in {
    packages = {
      inherit (pkgs) versiajs;
      default = self.packages.${system}.versiajs;
    };
    apps.update-modules = {
      type = "app";
      program = ./nix/update.sh;
    };
  }) //
  flake-utils.lib.eachDefaultSystem (system: let
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    devShells = {
      default = pkgs.mkShell {
        buildInputs = with pkgs; [
          bun
          nodejs
          nodePackages.typescript
          nodePackages.typescript-language-server
          nix-ld
        ];
      };
    };
  });
}
