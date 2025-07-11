# Node is required for building the project
FROM imbios/bun-node:latest-23-alpine AS base

# Install dependencies into temp directory
# This will cache them and speed up future builds
FROM base AS install

RUN mkdir -p /temp
COPY . /temp
WORKDIR /temp
RUN bun install --production

FROM base AS build

# Copy the project
RUN mkdir -p /temp
COPY . /temp
# Copy dependencies
COPY --from=install /temp/node_modules /temp/node_modules

# Build the project
WORKDIR /temp
RUN bun run build api
WORKDIR /temp/dist

# Copy production dependencies and source code into final image
FROM oven/bun:1.2.18-alpine

# Install libstdc++ for Bun and create app directory
RUN mkdir -p /app

COPY --from=build /temp/dist /app/dist
COPY entrypoint.sh /app

LABEL org.opencontainers.image.authors="Gaspard Wierzbinski (https://cpluspatch.com)"
LABEL org.opencontainers.image.source="https://github.com/versia-pub/server"
LABEL org.opencontainers.image.vendor="Versia Pub"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.title="Versia Server"
LABEL org.opencontainers.image.description="Versia Server Docker image"

# Set current Git commit hash as an environment variable
ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

# CD to app
WORKDIR /app
ENV NODE_ENV=production
ENTRYPOINT [ "/bin/sh", "/app/entrypoint.sh" ]
# Run migrations and start the server
CMD [ "bun", "run", "api.js" ]
