# Use the official Bun image (Bun doesn't run well on Musl but this seems to work)
# See all versions at https://hub.docker.com/r/oven/bun/tags
FROM imbios/bun-node:1.1.2-current-alpine as base

# Install dependencies into temp directory
# This will cache them and speed up future builds
FROM base AS install

# Install with --production (exclude devDependencies)
RUN mkdir -p /temp
COPY . /temp
WORKDIR /temp
RUN bun install --frozen-lockfile

FROM base as build

# Copy the project
RUN mkdir -p /temp
COPY . /temp
# Copy dependencies
COPY --from=install /temp/node_modules /temp/node_modules
# Build the project
WORKDIR /temp
RUN bunx --bun prisma generate
RUN bun run prod-build

# copy production dependencies and source code into final image
FROM oven/bun:1.1.2-alpine

# Create app directory
RUN mkdir -p /app
COPY --from=build /temp/dist /app/dist
COPY entrypoint.sh /app

LABEL org.opencontainers.image.authors "Gaspard Wierzbinski (https://cpluspatch.dev)"
LABEL org.opencontainers.image.source "https://github.com/lysand-org/lysand"
LABEL org.opencontainers.image.vendor "Lysand Org"
LABEL org.opencontainers.image.licenses "AGPL-3.0"
LABEL org.opencontainers.image.title "Lysand Server"
LABEL org.opencontainers.image.description "Lysand Server docker image"

# CD to app
WORKDIR /app
ENV NODE_ENV=production
ENTRYPOINT [ "/bin/sh", "entrypoint.sh" ]
# Run migrations and start the server
CMD [ "start" ]
