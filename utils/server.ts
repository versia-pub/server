import type { OpenAPIHono, z } from "@hono/zod-openapi";
import type { Server } from "bun";
import type { ConfigSchema } from "~/classes/config/schema.ts";
import type { HonoEnv } from "~/types/api";
import { debugResponse } from "./api.ts";

export const createServer = (
    config: z.infer<typeof ConfigSchema>,
    app: OpenAPIHono<HonoEnv>,
): Server =>
    Bun.serve({
        port: config.http.bind_port,
        reusePort: true,
        // @ts-expect-error @types/bun is missing the tls property for some reason
        // see https://github.com/oven-sh/bun/issues/13167
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

            if (config.logging.types.responses) {
                await debugResponse(output.clone());
            }

            return output;
        },
    });
