# Bun doesn't run well on Musl but this seems to work
FROM oven/bun:1.1.29-alpine as base

# Switch to Bash by editing /etc/passwd
RUN apk add --no-cache libstdc++=^13.0.0 git=^2.0.0 bash^5.0.0 curl^8.0.0 openssh^9.7.0 cloc^2.0.0 && \
    sed -i -e 's|/bin/ash|/bin/bash|g' /etc/passwd

# Extract Node from its docker image (node:22-alpine)
COPY --from=node:22-alpine /usr/local/bin/node /usr/local/bin/node