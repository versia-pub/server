# Contributing to Lysand

> [!NOTE]
> This document was authored by [@CPlusPatch](https://github.com/CPlusPatch).

Thank you for your interest in contributing to Lysand! We welcome contributions from everyone, regardless of their level of experience or expertise.

# Tech Stack

Lysand is built using the following technologies:

- [Bun](https://bun.sh) - A JavaScript runtime similar to Node.js, but faster and with more features
- [PostgreSQL](https://www.postgresql.org/) - A relational database
  - [`pg_uuidv7`](https://github.com/fboulnois/pg_uuidv7) - A PostgreSQL extension that provides a UUIDv7 data type
- [Nuxt](https://nuxt.com/) - A Vue.js framework, used for the frontend
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
git clone https://github.com/lysand-org/lysand.git
```

2. Install the dependencies

```bash
bun install
```

3. Set up a PostgreSQL database (you need a special extension, please look at [the database documentation](database.md))

4. Copy the `config/config.toml.example` file to `config/config.toml` and edit it to set up the database connection and other settings.

## Testing your changes

To start the live server on the address and port specified on the config file, run:
```sh
bun dev
```

If your port number is lower than 1024, you may need to run the command as root.

### Running the FE

To start the frontend server, run:
```sh
bun fe:dev
```

This should be run in a separate process as the server.

## Running tests

To run the tests, run:
```sh
bun test
```

The tests are located in the `tests/` directory and follow a Jest-like syntax. The server should be shut down before running the tests.

## Code style

We use [Biome](https://biomejs.dev) to enforce a consistent code style. To check if your code is compliant, run:

```sh
bunx @biomejs/biome check .
```

To automatically fix the issues, run:
```sh
bunx @biomejs/biome check . --apply
```

You can also install the Biome Visual Studio Code extension and have it format your code automatically on save.

### ESLint rules

Linting should not be ignored, except if they are false positives, in which case you can use a comment to disable the rule for the line or the file. If you need to disable a rule, please add a comment explaining why.

TypeScript errors should be ignored with `// @ts-expect-error` comments, as well as with a reason for being ignored.

### Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org) for our commit messages. This allows us to automatically generate the changelog and the version number.

### Pull requests

When you are done with your changes, you can open a pull request. Please make sure that your code is compliant with the code style and that the tests pass before opening a pull request.

### Writing tests

We use Bun's integrated testing system to write tests. You can find more information about it [here](https://bun.sh/docs/cli/test). It uses a Jest-like syntax.

Tests **should** be written for all API routes and all functions that are not trivial. If you are not sure whether you should write a test for something, you probably should.

#### Adding per-route tests

To add tests for a route, create a `route_file_name.test.ts` file in the same directory as the route itself. See [this example](/server/api/api/v1/timelines/home.test.ts) for help writing tests.

### Writing documentation

Documentation for the Lysand protocol is available on [lysand.org](https://lysand.org/). If you are thinking of modifying the protocol, please make sure to send a pull request over there to get it approved and merged before you send your pull request here.

This project should not need much documentation, but if you think that something needs to be documented, please add it to the README, docs or contribution guide.

## Reporting bugs

If you find a bug, please open an issue on GitHub. Please make sure to include the following information:

- The steps to reproduce the bug
- The expected behavior
- The actual behavior
- The version of Lysand you are using
- The version of Bun you are using
- The version of PostgreSQL you are using
- Your operating system and version

# License

Lysand is licensed under the [AGPLv3 or later](https://www.gnu.org/licenses/agpl-3.0.en.html) license. By contributing to Lysand, you agree to license your contributions under the same license.