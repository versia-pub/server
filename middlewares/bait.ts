import { logger } from "@/loggers";
import { errorResponse, response } from "@/response";
import type { SocketAddress } from "bun";
import { createMiddleware } from "hono/factory";
import { matches } from "ip-matching";
import { config } from "~/packages/config-manager";
import { LogLevel } from "~/packages/log-manager";

export const bait = createMiddleware(async (context, next) => {
    const requestIp = context.env?.ip as SocketAddress | undefined | null;

    if (config.http.bait.enabled) {
        // Check for bait IPs
        if (requestIp?.address) {
            for (const ip of config.http.bait.bait_ips) {
                try {
                    if (matches(ip, requestIp.address)) {
                        const file = Bun.file(
                            config.http.bait.send_file || "./beemovie.txt",
                        );

                        if (await file.exists()) {
                            return response(file);
                        }
                        await logger.log(
                            LogLevel.Error,
                            "Server.Bait",
                            `Bait file not found: ${config.http.bait.send_file}`,
                        );
                    }
                } catch (e) {
                    logger.log(
                        LogLevel.Error,
                        "Server.IPCheck",
                        `Error while parsing bait IP "${ip}" `,
                    );
                    logger.logError(
                        LogLevel.Error,
                        "Server.IPCheck",
                        e as Error,
                    );

                    return errorResponse(
                        `A server error occured: ${(e as Error).message}`,
                        500,
                    );
                }
            }
        }

        // Check for bait user agents (regex)
        const ua = context.req.header("user-agent") ?? "";

        for (const agent of config.http.bait.bait_user_agents) {
            if (new RegExp(agent).test(ua)) {
                const file = Bun.file(
                    config.http.bait.send_file || "./beemovie.txt",
                );

                if (await file.exists()) {
                    return response(file);
                }
                await logger.log(
                    LogLevel.Error,
                    "Server.Bait",
                    `Bait file not found: ${config.http.bait.send_file}`,
                );
            }
        }
    }

    await next();
});
