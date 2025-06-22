import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { serverLogger } from "@versia-server/logging";
import type { SocketAddress } from "bun";
import { createMiddleware } from "hono/factory";
import { matches } from "ip-matching";

export const ipBans = createMiddleware(async (context, next) => {
    // Check for banned IPs

    const requestIp = context.env?.ip as SocketAddress | undefined | null;

    if (!requestIp?.address) {
        await next();
        return;
    }

    for (const ip of config.http.banned_ips) {
        try {
            if (matches(ip, requestIp?.address)) {
                throw new ApiError(403, "Forbidden");
            }
        } catch (e) {
            serverLogger.error`Error while parsing banned IP "${ip}" `;
            serverLogger.error`${e}`;

            return context.json(
                { error: `A server error occured: ${(e as Error).message}` },
                500,
            );
        }
    }

    await next();
    return;
});
