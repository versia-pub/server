# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.0.15-alpine as base
WORKDIR /usr/src/app

RUN apk add vips
# Required for Prisma to work
COPY --from=node:18-alpine /usr/local/bin/node /usr/local/bin/node

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY . /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production.

# Build Vite in pages
RUN cd /temp/prod && bunx --bun vite build pages

# Build the project
RUN cd /temp/prod && bun run build.ts

# copy production dependencies and source code into final image
FROM base AS release

# Create app directory
RUN mkdir -p /app
COPY --from=install /temp/prod/dist /app/dist
COPY --from=install /temp/prod/pages /app/pages
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
# Run migrations and start the server
ENTRYPOINT [ "./entrypoint.sh" "start" ]
