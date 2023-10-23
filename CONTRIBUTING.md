# Contributing to Lysand
Thank you for your interest in contributing to Lysand! We welcome contributions from everyone, regardless of their level of experience or expertise.

## Getting Started
To get started, please follow these steps:

1. Fork the repository, clone it on your local system and make your own branch
2. Install the [Bun](https://bun.sh) runtime:
```sh
curl -fsSL https://bun.sh/install | bash
```
3. Run `bun install` in the project directory to install the dependencies
```sh
bun install
```
> You will need a running PostgreSQL database for the next step

> If you don't have a running PostgreSQL instance, you can use the following `docker-compose.yml` file to start one:
> ```yaml
>services:
>  db:
>    image: postgres:13-alpine
>    restart: always
>    init: true
>    environment: {
>      POSTGRES_USER: fediproject,
>      POSTGRES_PASSWORD: fediproject,
>      POSTGRES_DB: fediproject
>    }
>    ports:
>      - 5432:5432
>    volumes:
>      - ./data:/var/lib/postgresql/data
> ```

4. Copy the `config/config.example.toml` file to `config/config.toml` and change the database connection values to your own Postgres instance
> For the example above, the values would be:
> ```toml
> [database]
> host = "localhost"
> port = 5432
> username = "fediproject"
> password = "fediproject"
> database = "fediproject"
> ```
5. Fill in the rest of the config file with your own configuration (you can leave most things to the default)

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

The tests are located in the `tests/` directory and follow a Jest-like syntax.