{
  description = "Lysand Server";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }: {
    hydraJobs = {
      inherit (self) packages;
    };
  } // flake-utils.lib.eachDefaultSystem (system:
  let 
    pkgs = import nixpkgs {
      inherit system;
    };
  in {
    packages = {
      versiajs = pkgs.callPackage ./nix/package.nix {};
      default = self.packages.${system}.versiajs;
    };

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
