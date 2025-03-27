# Node is required for building the project
FROM imbios/bun-node:1-20-alpine AS base

RUN apk add --no-cache libstdc++

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
RUN bun run build:worker
WORKDIR /temp/dist

# Copy production dependencies and source code into final image
FROM oven/bun:1.2.7-alpine

# Install libstdc++ for Bun and create app directory
RUN apk add --no-cache libstdc++ && \
    mkdir -p /app

COPY --from=build /temp/dist /app/dist
COPY entrypoint.sh /app

LABEL org.opencontainers.image.authors="Gaspard Wierzbinski (https://cpluspatch.dev)"
LABEL org.opencontainers.image.source="https://github.com/versia-pub/server"
LABEL org.opencontainers.image.vendor="Versia Pub"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.title="Versia Server Worker"
LABEL org.opencontainers.image.description="Versia Server Worker Docker image"

# Set current Git commit hash as an environment variable
ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

# CD to app
WORKDIR /app/dist
ENV NODE_ENV=production
# Run migrations and start the server
CMD [ "bun", "run", "index.js" ]
