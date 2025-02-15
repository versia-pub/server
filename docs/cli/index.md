# Versia Server CLI

Versia Server includes a built-in, scripting-compatible CLI that can be used to manage the server. This CLI can be used to create and delete users, manage the database and more. It can also output data in JSON or CSV format, making it easy to use in scripts.

## Using the CLI

Versia Server includes a built-in CLI for managing the server. To use it, simply run the following command:

```bash
# Docker
# Replace `versia` with the name of your container
docker compose exec -it versia /bin/sh /app/entrypoint.sh cli help
```

You can use the `help` command to see a list of available commands. These include creating users, deleting users and more. Each command also has a `--help,-h` flag that you can use to see more information about the command.

## Scripting with the CLI

Some CLI commands that return data as tables can be used in scripts. To convert them to JSON or CSV, some commands allow you to specify a `--format` flag that can be either `"json"` or `"csv"`. See `cli help` or `cli <command> -h` for more information.

Flags can be used in any order and anywhere in the script (except for the `cli` command itself).
