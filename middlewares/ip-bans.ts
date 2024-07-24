import { errorResponse } from "@/response";
import { sentry } from "@/sentry";
import { createMiddleware } from "@hono/hono/factory";
import { getLogger } from "@logtape/logtape";
import type { SocketAddress } from "bun";
import { matches } from "ip-matching";
import { config } from "~/packages/config-manager";

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
                return errorResponse("Forbidden", 403);
            }
        } catch (e) {
            const logger = getLogger("server");

            logger.error`Error while parsing banned IP "${ip}" `;
            logger.error`${e}`;
            sentry?.captureException(e);

            return errorResponse(
                `A server error occured: ${(e as Error).message}`,
                500,
            );
        }
    }

    await next();
});
