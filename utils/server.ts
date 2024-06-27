import type { Config } from "config-manager";
import type { Hono } from "hono";

export const createServer = (config: Config, app: Hono) =>
    Bun.serve({
        port: config.http.bind_port,
        reusePort: true,
        tls: config.http.tls.enabled
            ? {
                  key: Bun.file(config.http.tls.key),
                  cert: Bun.file(config.http.tls.cert),
                  passphrase: config.http.tls.passphrase,
                  ca: config.http.tls.ca
                      ? Bun.file(config.http.tls.ca)
                      : undefined,
              }
            : undefined,
        hostname: config.http.bind || "0.0.0.0", // defaults to "0.0.0.0"
        fetch(req, server) {
            return app.fetch(req, { ip: server.requestIP(req) });
        },
    });
