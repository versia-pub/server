# Contributing to Lysand

> This document was authored by [@CPlusPatch](https://github.com/CPlusPatch).

Thank you for your interest in contributing to Lysand! We welcome contributions from everyone, regardless of their level of experience or expertise.

# Tech Stack

Lysand is built using the following technologies:

- [Bun](https://bun.sh) - A JavaScript runtime similar to Node.js, but improved
- [PostgreSQL](https://www.postgresql.org/) - A relational database
  - [`pg_uuidv7`](https://github.com/fboulnois/pg_uuidv7) - A PostgreSQL extension that provides a UUIDv7 data type
- [UnoCSS](https://unocss.dev) - A utility-first CSS framework, used for the login page
- [Docker](https://www.docker.com/) - A containerization platform, used for development and deployment
- [Sharp](https://sharp.pixelplumbing.com/) - An image processing library, used for fast image resizing and converting
- [TypeScript](https://www.typescriptlang.org/) - A typed superset of JavaScript
- [ESLint](https://eslint.org/) - A JavaScript linter
- [Prettier](https://prettier.io/) - A code formatter

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

3. Set up a PostgreSQL database, using the `pg_uuidv7` extension

You may use the following [Dockerfile](Postgres.Dockerfile) to set it up:
    
```Dockerfile
# Use the latest Postgres Docker image based on Alpine
FROM postgres:alpine

# Set working directory
WORKDIR /usr/src/app

# Install curl
RUN apk add --no-cache curl

RUN cd "$(mktemp -d)" \
        && curl -LO "https://github.com/fboulnois/pg_uuidv7/releases/download/v1.3.0/{pg_uuidv7.tar.gz,SHA256SUMS}" \
        && tar xf pg_uuidv7.tar.gz \
        && sha256sum -c SHA256SUMS \
        && PG_MAJOR=$(pg_config --version | sed 's/^.* \([0-9]\{1,\}\).*$/\1/') \
        && cp "$PG_MAJOR/pg_uuidv7.so" "$(pg_config --pkglibdir)" \
        && cp sql/pg_uuidv7--1.3.sql pg_uuidv7.control "$(pg_config --sharedir)/extension"
# Add a script to run the CREATE EXTENSION command
RUN echo '#!/bin/sh\npsql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION pg_uuidv7;"' > /docker-entrypoint-initdb.d/init.sh

# Make the entrypoint script executable
RUN chmod +x /docker-entrypoint-initdb.d/init.sh
```

4. Copy the `config.toml.example` file to `config.toml` and fill in the values (you can leave most things to the default, but you will need to configure things such as the database connection)

5. Run migrations:

```bash
bun migrate
```

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

The tests are located in the `tests/` directory and follow a Jest-like syntax. The server must be started with `bun dev` before running the tests.

## Code style

We use ESLint and Prettier to enforce a consistent code style. To check if your code is compliant, run:
```sh
bun lint
```

To automatically fix the issues, run:
```sh
bun lint --fix
```

You should have the [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) and [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extensions installed in VSCode, if you use it. From the ESLint extension, you can automatically fix the issues with `Ctrl+Shift+P` and `ESLint: Fix all auto-fixable Problems`.

ESLint and Prettier are also integrated in the CI pipeline, so your code will be automatically checked when you push it. If the pipeline fails, you will need to fix the issues before your pull request can be merged.

Code style such as brackets, spaces/tabs, etc are enforced by Prettier's ESLint plugin. You can find the simple configuration in the `.prettierrc` file.

### ESLint rules

ESLint errors should not be ignored, except if they are false positives, in which case you can use a comment to disable the rule for the line or the file. If you need to disable a rule, please add a comment explaining why.

TypeScript errors should be ignored with `// @ts-expect-error` comments, as well as with a reason for being ignored.

### Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for our commit messages. This allows us to automatically generate the changelog and the version number.

> **Note**: I don't actually enforce this rule, but it would be great if you could follow it.

### Pull requests

When you are done with your changes, you can open a pull request. Please make sure that your code is compliant with the code style and that the tests pass before opening a pull request.

### Writing tests

We use Bun's integrated testing system to write tests. You can find more information about it [here](https://bun.sh/docs/cli/test). It uses a Jest-like syntax.

Tests **must** be written for all API routes and all functions that are not trivial. If you are not sure whether you should write a test for something, you probably should.

To help with the creation of tests, you may find [GitHub Copilot](https://copilot.github.com/) useful (or some of its free alternatives like [Codeium](https://codeium.com/))

### Writing documentation

Documentation for the Lysand protocol is available on [lysand.org](https://lysand.org/). If you are thinking of modifying the protocol, please make sure to send a pull request over there to get it approved and merged before you send your pull request here.

This project should not need much documentation, but if you think that something needs to be documented, please add it to the README or contribution guide.

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

Lysand is licensed under the [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html) license. By contributing to Lysand, you agree to license your contributions under the same license.