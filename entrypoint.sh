#!/bin/bash

# This script is a wrapper for the main server, CLI and Prisma binaries.
# Commands:
# - `start`: Starts the server
# - `cli`: Starts the CLI, sends all arguments to it
# - `prisma`: Execute a Prisma command, sends 

# Exit immediately if a command exits with a non-zero status.
set -euxo pipefail

cd /app/dist

# Parse first argument
case "$1" in
  "start")
    # Migrate the database
    exec /bin/bash /app/entrypoint.sh prisma migrate deploy
    # Start the server
    exec bun run ./index.js --prod
    ;;
  "cli")
    # Start the CLI
    shift 1
    exec bun run ./cli.js "$@"
    ;;
  "prisma")
    # Proxy all Prisma commands
    # Use output of dist/prisma.js to get the env variable
    shift 1
    # Set DATABASE_URL env variable to the output of bun run ./dist/prisma.js
    export DATABASE_URL=$(bun run ./prisma.js)
    # Execute the Prisma binary
    exec ./node_modules/.bin/prisma "$@"
    ;;
  *)
    # Run custom commands
    exec "$@"
    ;;
esac
```