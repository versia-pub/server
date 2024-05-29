import { logger } from "@/loggers";
import { errorResponse } from "@/response";
import type { SocketAddress } from "bun";
import { createMiddleware } from "hono/factory";
import { matches } from "ip-matching";
import { config } from "~/packages/config-manager";
import { LogLevel } from "~/packages/log-manager";

export const ipBans = createMiddleware(async (context, next) => {
    // Check for banned IPs

    const request_ip = context.env?.ip as SocketAddress | undefined | null;

    if (!request_ip?.address) {
        await next();
        return;
    }

    for (const ip of config.http.banned_ips) {
        try {
            if (matches(ip, request_ip?.address)) {
                return errorResponse("Forbidden", 403);
            }
        } catch (e) {
            logger.log(
                LogLevel.ERROR,
                "Server.IPCheck",
                `Error while parsing banned IP "${ip}" `,
            );
            logger.logError(LogLevel.ERROR, "Server.IPCheck", e as Error);

            return errorResponse(
                `A server error occured: ${(e as Error).message}`,
                500,
            );
        }
    }

    await next();
});
