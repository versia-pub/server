# Contributing to Versia

> [!NOTE]
> This document was authored by [@CPlusPatch](https://github.com/CPlusPatch).

Thank you for your interest in contributing to Versia Server! We welcome contributions from everyone, regardless of their level of experience or expertise.

# Tech Stack

Versia Server is built using the following technologies:

- [Bun](https://bun.sh) - A JavaScript runtime similar to Node.js, but faster and with more features
- [PostgreSQL](https://www.postgresql.org/) - A relational database
  - [`pg_uuidv7`](https://github.com/fboulnois/pg_uuidv7) - A PostgreSQL extension that provides a UUIDv7 data type
- [Docker](https://www.docker.com/) - A containerization platform, used for development and deployment
- [Sharp](https://sharp.pixelplumbing.com/) - An image processing library, used for fast image resizing and converting
- [TypeScript](https://www.typescriptlang.org/) - A typed superset of JavaScript

## Getting Started

To get started, please follow these steps:

1. Fork the repository, clone it on your local system and make your own branch
2. Install the [Bun](https://bun.sh) runtime:
```sh
curl -fsSL https://bun.sh/install | bash
```
1. Clone this repository

```bash
git clone https://github.com/lysand-org/server.git
```

2. Install the dependencies

```bash
bun install
```

3. Set up a PostgreSQL database (you need a special extension, please look at [the database documentation](docs/database.md))

4. Copy the `config/config.example.toml` file to `config/config.toml` and edit it to set up the database connection and other settings.

## HTTPS development

To develop with HTTPS, you need to generate a self-signed certificate. We will use [`mkcert`](https://github.com/FiloSottile/mkcert) for this purpose.

1. Install `mkcert`:
2. Generate a certificate for the domain you are using:
```sh
mkcert -install
# You can change the domain to whatever you want, but it must resolve via /etc/hosts
# *.localhost domains are automatically aliased to localhost by DNS
mkcert -key-file config/versia.localhost-key.pem -cert-file config/versia.localhost.pem versia.localhost
```
3. Edit the config:
```toml
[http]
base_url = "https://versia.localhost:9900"
bind = "versia.localhost"
bind_port = 9900 # Change the port to whatever you want

[http.tls]
enabled = true
key = "config/versia.localhost-key.pem"
cert = "config/versia.localhost.pem"
passphrase = ""
ca = ""
```

Now, running the server will use the certificate you generated.

## Testing your changes

To start the live server on the address and port specified on the config file, run:
```sh
bun dev
```

If your port number is lower than 1024, you may need to run the command as root.

## Running tests

To run the tests, run:
```sh
bun test
```

The tests are located all around the codebase (filename `*.test.ts`) and follow a Jest-like syntax. The server should be shut down before running the tests.

## Code style

We use [Biome](https://biomejs.dev) to enforce a consistent code style. To check if your code is compliant, run:

```sh
bun lint
```

To automatically fix the issues, run:
```sh
bun lint --write
```

You can also install the Biome Visual Studio Code extension and have it format your code automatically on save.

### TypeScript

Linting should not be ignored, except if they are false positives, in which case you can use a comment to disable the rule for the line or the file. If you need to disable a rule, please add a comment explaining why.

TypeScript errors should be ignored with `// @ts-expect-error` comments, as well as with a reason for being ignored.

To scan for all TypeScript errors, run:
```sh
bun check
```

### Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org) for our commit messages. This allows us to automatically generate the changelog and the version number, while also making it easier to understand what changes were made in each commit.

### Pull requests

When you are done with your changes, you can open a pull request. Please make sure that your code is compliant with the code style and that the tests pass before opening a pull request.

### Writing tests

We use Bun's integrated testing system to write tests. You can find more information about it [here](https://bun.sh/docs/cli/test). It uses a Jest-like syntax.

Tests **should** be written for all API routes and all functions that are not trivial. If you are not sure whether you should write a test for something, you probably should.

#### Adding per-route tests

To add tests for a route, create a `route_file_name.test.ts` file in the same directory as the route itself. See [this example](/server/api/api/v1/timelines/home.test.ts) for help writing tests.

### Writing documentation

Documentation for the Versia protocol is available on [versia.pub](https://versia.pub/). If you are thinking of modifying the protocol, please make sure to send a pull request over there to get it approved and merged before you send your pull request here.

This project should not need much documentation, but if you think that something needs to be documented, please add it to the README, docs or contribution guide.

## Reporting bugs

If you find a bug, please open an issue on GitHub. Please make sure to include the following information:

- The steps to reproduce the bug
- The expected behavior
- The actual behavior
- The version of Versia Server you are using
- The version of Bun you are using
- The version of PostgreSQL you are using
- Your operating system and version

# License

Versia Server is licensed under the [AGPLv3 or later](https://www.gnu.org/licenses/agpl-3.0.en.html) license. By contributing to Versia, you agree to license your contributions under the same license.