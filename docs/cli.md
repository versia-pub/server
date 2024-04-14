# Lysand CLI

Lysand includes a built-in, scripting-compatible CLI that can be used to manage the server. This CLI can be used to create and delete users, manage the database and more. It can also output data in JSON or CSV format, making it easy to use in scripts.

## Using the CLI

Lysand includes a built-in CLI for managing the server. To use it, simply run the following command:

```bash
# Development
bun cli help
# Source installs
bun run dist/cli.js help
# Docker
docker compose exec -it lysand /bin/sh /app/entrypoint.sh cli help
```

You can use the `help` command to see a list of available commands. These include creating users, deleting users and more. Each command also has a `--help,-h` flag that you can use to see more information about the command.

## Scripting with the CLI

Some CLI commands that return data as tables can be used in scripts. To convert them to JSON or CSV, some commands allow you to specify a `--format` flag that can be either `"json"` or `"csv"`. See `bun cli help` or `bun cli <command> -h` for more information.

Flags can be used in any order and anywhere in the script (except for the `bun cli` command itself). The command arguments themselves must be in the correct order, however.Z