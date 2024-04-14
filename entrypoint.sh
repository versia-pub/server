#!/bin/bash

# This script is a wrapper for the main server, CLI and Prisma binaries.
# Commands:
# - `start`: Starts the server
# - `cli`: Starts the CLI, sends all arguments to it

# Exit immediately if a command exits with a non-zero status.
set -euo pipefail

cd /app/dist

# Parse first argument
case "$1" in
  "start")
    NITRO_PORT=5173 bun run ./frontend/server/index.mjs & NODE_ENV=production bun run ./index.js --prod
    ;;
  "cli")
    # Start the CLI
    shift 1
    bun run ./cli.js "$@"
    ;;
  *)
    # Run custom commands
    exec "$@"
    ;;
esac