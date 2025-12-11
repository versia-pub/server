import type { ConfigSchema } from "@versia-server/config";
import { debugResponse } from "@versia-server/kit/api";
import { type Server, serve } from "bun";
import type { Hono } from "hono";
import { matches } from "ip-matching";
import type { z } from "zod";
import type { HonoEnv } from "~/types/api.ts";

export const createServer = (
    config: z.infer<typeof ConfigSchema>,
    app: Hono<HonoEnv>,
): Server<undefined> =>
    serve({
        port: config.http.bind_port,
        reusePort: true,
        tls: config.http.tls
            ? {
                  key: config.http.tls.key.file,
                  cert: config.http.tls.cert.file,
                  passphrase: config.http.tls.passphrase,
                  ca: config.http.tls.ca?.file,
              }
            : undefined,
        hostname: config.http.bind,
        async fetch(req, server): Promise<Response> {
            const ip = server.requestIP(req);
            const isTrustedProxy =
                config.http.proxy_ips.includes("*") ||
                (ip &&
                    config.http.proxy_ips.some((proxyIp) =>
                        matches(ip.address, proxyIp),
                    ));

            const url = new URL(req.url);

            if (ip && isTrustedProxy) {
                const xff = req.headers.get("x-forwarded-for");
                const xfp = req.headers.get("x-forwarded-proto");

                if (xff) {
                    const forwardedIps = xff.split(",").map((s) => s.trim());
                    const originalIp = forwardedIps[0];

                    ip.address = originalIp;
                    ip.family = originalIp.includes(":") ? "IPv6" : "IPv4";
                }

                if (xfp) {
                    url.protocol = xfp;
                }
            }

            const output = await app.fetch(req, { ip });

            await debugResponse(output.clone());

            return output;
        },
    });
