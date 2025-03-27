# Bun doesn't run well on Musl but this seems to work
FROM oven/bun:1.2.7-alpine as base

# Switch to Bash by editing /etc/passwd
RUN apk add --no-cache libstdc++ git bash curl openssh cloc && \
    sed -i -e 's|/bin/ash|/bin/bash|g' /etc/passwd

# Extract Node from its docker image (node:22-alpine)
COPY --from=node:22-alpine /usr/local/bin/node /usr/local/bin/node
