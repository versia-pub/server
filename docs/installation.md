# Installation

## Requirements

- The [Bun Runtime](https://bun.sh), version 1.1.21 or later (usage of the latest version is recommended)
  - Lysand will work on lower versions than 1.1.21, but only the latest version is supported
- A PostgreSQL database
- (Optional but recommended) A Linux-based operating system
- (Optional if you want search) A working [Sonic](https://github.com/valeriansaliou/sonic) instance

> [!WARNING]
> Lysand has not been tested on Windows or macOS. It is recommended to use a Linux-based operating system to run Lysand.
> 
> We will not be offering support to Windows or macOS users. If you are using one of these operating systems, please use a virtual machine or container to run Lysand.

## With Docker/Podman

Docker is the recommended way to run Lysand (Podman also works). To run Lysand with Docker, follow these steps:

1. Download the `docker-compose.yml` file from the repository

> [!NOTE]
> You may need to change the image from `ghcr.io/lysand-org/lysand:latest` to `ghcr.io/lysand-org/lysand:main` if you want to use the latest changes from the `main` branch. Make sure to use the config template from the same branch as the server.

> [!CAUTION]
> The `latest` tag on the Docker image refers to the latest release (currently `v0.6.0`), not the latest commit on the `main` branch.
>
> **Do not mix configurations from different branches, or everything will break with confusing errors!**

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/lysand-org/lysand/main/docker-compose.yml
```
1. Edit the `docker-compose.yml` file to set up the database connection and other settings
2. Download the `config.example.toml` file from the repository

```bash
# From main branch
curl -o config.example.toml https://raw.githubusercontent.com/lysand-org/lysand/main/config/config.example.toml
# For a specific release (e.g. v0.6.0)
curl -o config.example.toml https://raw.githubusercontent.com/lysand-org/lysand/v0.6.0/config/config.example.toml
```
4. Edit the `config.example.toml` file to set up the database connection and other settings, rename it to `config.toml`, then place it inside `config/` (create the `config/` directory if it does not exist)
5. Run the following command to start the server:

> [!WARNING]
> The first time you start the server, it will generate keys which will be printed in logs. The server will not start until you put these keys in the config file.

```bash
docker compose up
```

You may need root privileges to run Docker commands.

To check server logs, run `docker compose logs lysand`. The server will likely stop if there is an error, so you can check the logs to see what went wrong.

## From Source

1. Clone this repository

```bash
git clone https://github.com/lysand-org/lysand.git
```

2. Install the dependencies

```bash
bun install
```

1. Set up a PostgreSQL database (you need a special extension, please look at [the database documentation](database.md))

2. (If you want search)
Create a [Sonic](https://github.com/valeriansaliou/sonic) instance (using Docker is recommended). For a [`docker-compose`] file, copy the `sonic` service from the [`docker-compose.yml`](../docker-compose.yml) file. Don't forget to fill in the `config.cfg` for Sonic!

1. Build everything:

```bash
bun run build
```

4. Copy the `config.example.toml` file to `config.toml` inside `dist/config/` and fill in the values (you can leave most things to the default, but you will need to configure things such as the database connection)

CD to the `dist/` directory: `cd dist`

You may now start the server with `bun run cli/index.js start`. It lives in the `dist/` directory, all the other code can be removed from this point onwards.

## Running the Server

Database migrations are run automatically on startup.

You may use the environment variables `NO_COLORS=true` and `NO_FANCY_DATES=true` to disable colors and date formatting in the console logs: the file logs will never have colors or fancy dates.

Please see the [CLI documentation](cli.md) for more information on how to use the CLI.

> [!NOTE]
> You might be interested in running the [Glitch-Soc](glitch-soc.md) frontend, which is a fork of Mastodon's frontend with additional features.
>
> This is possible by following the instructions in [this file](glitch-soc.md).

## Updating the server

Updating the server is as simple as pulling the latest changes from the repository and running `bun prod-build` again. You may need to run `bun install` again if there are new dependencies.

For Docker, you can run `docker-compose pull` to update the Docker images.

Sometimes, new configuration options are added to `config.example.toml`. If you see a new option in the example file, you should add it to your `config.toml` file.