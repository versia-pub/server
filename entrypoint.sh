#!/bin/bash

# This script is a wrapper for the main server, CLI and Prisma binaries.
# Commands:
# - `start`: Starts the server
# - `cli`: Starts the CLI, sends all arguments to it
# - `prisma`: Execute a Prisma command, sends 

# Exit immediately if a command exits with a non-zero status.
set -euo pipefail

cd /app/dist

# Parse first argument
case "$1" in
  "start")
    # Migrate the database and run
    /bin/bash /app/entrypoint.sh prisma migrate deploy
    NITRO_PORT=5173 bun run dist/frontend/server/index.mjs & NODE_ENV=production bun run dist/index.js --prod
    ;;
  "cli")
    # Start the CLI
    shift 1
    bun run ./cli.js "$@"
    ;;
  "prisma")
    # Proxy all Prisma commands
    # Use output of dist/prisma.js to get the env variable
    shift 1
    # Set DATABASE_URL env variable to the output of bun run ./dist/prisma.js
    export DATABASE_URL=$(bun run ./prisma.js)
    # Execute the Prisma binary
    bun run ./node_modules/.bin/prisma "$@"
    ;;
  *)
    # Run custom commands
    exec "$@"
    ;;
esac