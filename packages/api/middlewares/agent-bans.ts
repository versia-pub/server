import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { createMiddleware } from "hono/factory";

export const agentBans = createMiddleware(async (context, next) => {
    // Check for banned user agents (regex)
    const ua = context.req.header("user-agent") ?? "";

    for (const agent of config.http.banned_user_agents) {
        if (new RegExp(agent).test(ua)) {
            throw new ApiError(403, "Forbidden");
        }
    }

    await next();
});
