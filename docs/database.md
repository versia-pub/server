# Installing the database

Versia Server uses a special PostgreSQL extension called `pg_uuidv7` to generate UUIDs. This extension is required for Versia Server to work properly. To install it, you can either use the pre-made Docker image or install it manually.

## Using the Docker image

Versia Server offers a pre-made Docker image for PostgreSQL with the extension already installed. Use `ghcr.io/versia-pub/postgres:main` as your Docker image name to use it.