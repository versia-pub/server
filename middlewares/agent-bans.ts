import { createMiddleware } from "hono/factory";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";

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
