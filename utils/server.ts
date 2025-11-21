import type { ConfigSchema } from "@versia-server/config";
import { debugResponse } from "@versia-server/kit/api";
import { type Server, serve } from "bun";
import type { Hono } from "hono";
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
            const output = await app.fetch(req, { ip: server.requestIP(req) });

            await debugResponse(output.clone());

            return output;
        },
    });
