# Installation

### Requirements

- The [Bun Runtime](https://bun.sh), version 1.1.13 or later (usage of the latest version is recommended)
  - Lysand will work on lower versions than 1.1.13, but only the latest version is supported
- A PostgreSQL database
- (Optional but recommended) A Linux-based operating system
- (Optional if you want search) A working Meiliseach instance

> [!WARNING]
> Lysand has not been tested on Windows or MacOS. It is recommended to use a Linux-based operating system to run Lysand.
> 
> We will not be offerring support to Windows or MacOS users. If you are using one of these operating systems, please use a virtual machine or container to run Lysand.

### With Docker/Podman

Docker is the recommended way to run Lysand (podman also works). To run Lysand with Docker, follow these steps:

1. Download the `docker-compose.yml` file from the repository

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/lysand-org/lysand/main/docker-compose.yml
```
2. Edit the `docker-compose.yml` file to set up the database connection and other settings
3. Download the `config.toml.example` file from the repository

```bash
curl -o config.toml.example https://raw.githubusercontent.com/lysand-org/lysand/main/config.toml.example
```
4. Edit the `config.toml.example` file to set up the database connection and other settings, then place it inside `config/` (create the `config/` directory if it does not exist)
5. Run the following command to start the server:

```bash
docker-compose up
```

You may need root privileges to run Docker commands.

### From Source

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
Create a Meilisearch instance (using Docker is recommended). For a [`docker-compose`] file, copy the `meilisearch` service from the [`docker-compose.yml`](docker-compose.yml) file.

Set up Meiliseach's API key by passing the `MEILI_MASTER_KEY` environment variable to the server. Then, enable and configure search in the config file.

3. Build everything:

```bash
bun prod-build
```

4. Copy the `config.toml.example` file to `config.toml` inside `dist/config/` and fill in the values (you can leave most things to the default, but you will need to configure things such as the database connection)

You may now start the server with `bun start`. It lives in the `dist/` directory, all the other code can be removed from this point onwards.

### Running the Server

Database migrations are run automatically on startup.

You may use the environment variables `NO_COLORS=true` and `NO_FANCY_DATES=true` to disable colors and date formatting in the console logs: the file logs will never have colors or fancy dates.

Please see the [CLI documentation](cli.md) for more information on how to use the CLI.

> [!NOTE]
> You might be interested in running the [Glitch-Soc](glitch-soc.md) frontend, which is a fork of Mastodon's frontend with additional features.
>
> This is possible by following the instructions in [this file](glitch-soc.md).

### Updating the server

Updating the server is as simple as pulling the latest changes from the repository and running `bun prod-build` again. You may need to run `bun install` again if there are new dependencies.

For Docker, you can run `docker-compose pull` to update the Docker images.

Sometimes, new configuration options are added to `config.example.toml`. If you see a new option in the example file, you should add it to your `config.toml` file.