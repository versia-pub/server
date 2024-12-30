import { sentry } from "@/sentry";
import { getLogger } from "@logtape/logtape";
import type { SocketAddress } from "bun";
import { createMiddleware } from "hono/factory";
import { matches } from "ip-matching";
import { ApiError } from "~/classes/errors/api-error";
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
                throw new ApiError(403, "Forbidden");
            }
        } catch (e) {
            const logger = getLogger("server");

            logger.error`Error while parsing banned IP "${ip}" `;
            logger.error`${e}`;
            sentry?.captureException(e);

            return context.json(
                { error: `A server error occured: ${(e as Error).message}` },
                500,
            );
        }
    }

    await next();
});
