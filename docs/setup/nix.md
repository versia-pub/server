# Nix Module

This project is packaged as a [Nix Flake](https://nixos.wiki/wiki/Flakes), which can be used to build and run the project in a reproducible environment.

## Installation

### Flake-based NixOS installs

Add the following to your `inputs` in your `flake.nix`:

```nix
inputs = {
  # ...
  versia-server = {
    url = "github:versia-pub/server";
    inputs.nixpkgs.follows = "nixpkgs";
  };
};
```

Then, add this to your `nixosConfigurations`:

```nix
nixosConfigurations = {
  # ...
  my-server = {
    system = "x86_64-linux"; # arm64-linux is also supported
    modules = [
      # ...
      {
        nixpkgs.overlays = [versia-server.overlays.default];
      }
      versia-server.nixosModules.versia-server
    ];
  };
};
```

You are now ready to use the NixOS module.

## Usage

This module exposes the following configuration option:

```nix
services.versia-server = {
    enable = true;

    user = "versia-server";
    group = "versia-server";

    nodes = {
        api = {
            main = {};
            backup = {
                configOverrides.http.port = 2734;
            };
        };
        worker = {
            one = {};
            two = {};
            three = {
                configOverrides.postgres.port = 5433;
            };
        };
    };

    config = {
        # ...
        http = {
            # ...
            bind = "0.0.0.0";
            port = 8080;
            base_url = "https://versia.example";
        };
        # ...
    };
};
```

### Configuration Options

- `enable`: Whether to enable the service. Default: `true`.
- `user`: The user under which the service will run. Default: `versia-server`.
- `group`: The group under which the service will run. Default: `versia-server`.
- `nodes`: A set of nodes to run. Each node can have its own configuration overrides, which will be merged with the default configuration. You must have at least one of each type (`api` and `worker`).
- `config`: Contents of the config file, which is serialized to TOML. Check the Versia Server documentation for information on its contents.
