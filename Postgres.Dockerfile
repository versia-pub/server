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