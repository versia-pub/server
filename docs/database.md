# Installing the database

Lysand uses a special PostgreSQL extension called `pg_uuidv7` to generate UUIDs. This extension is required for Lysand to work properly. To install it, you can either use the pre-made Docker image or install it manually.

## Using the Docker image

Lysand offers a pre-made Docker image for PostgreSQL with the extension already installed. Use `ghcr.io/lysand-org/postgres:main` as your Docker image name to use it.