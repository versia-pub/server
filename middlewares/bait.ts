import { logger } from "@/loggers";
import { response } from "@/response";
import type { SocketAddress } from "bun";
import { createMiddleware } from "hono/factory";
import { matches } from "ip-matching";
import { config } from "~/packages/config-manager";
import { LogLevel } from "~/packages/log-manager";

const baitFile = async () => {
    const file = Bun.file(config.http.bait.send_file || "./beemovie.txt");

    if (await file.exists()) {
        return file;
    }

    await logger.log(
        LogLevel.Error,
        "Server.Bait",
        `Bait file not found: ${config.http.bait.send_file}`,
    );
};

export const bait = createMiddleware(async (context, next) => {
    const requestIp = context.env?.ip as SocketAddress | undefined | null;

    if (!config.http.bait.enabled) {
        return await next();
    }

    const file = await baitFile();

    if (!file) {
        return await next();
    }

    // Check for bait IPs
    if (requestIp?.address) {
        for (const ip of config.http.bait.bait_ips) {
            if (matches(ip, requestIp.address)) {
                return response(file);
            }
        }
    }

    // Check for bait user agents (regex)
    const ua = context.req.header("user-agent") ?? "";

    for (const agent of config.http.bait.bait_user_agents) {
        if (new RegExp(agent).test(ua)) {
            return response(file);
        }
    }

    await next();
});
