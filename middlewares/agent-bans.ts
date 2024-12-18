import { createMiddleware } from "hono/factory";
import { config } from "~/packages/config-manager";

export const agentBans = createMiddleware(async (context, next) => {
    // Check for banned user agents (regex)
    const ua = context.req.header("user-agent") ?? "";

    for (const agent of config.http.banned_user_agents) {
        if (new RegExp(agent).test(ua)) {
            return context.json({ error: "Forbidden" }, 403);
        }
    }

    await next();
});
