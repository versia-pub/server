import { debugRequest } from "@/api";
import { createMiddleware } from "@hono/hono/factory";
import { config } from "~/packages/config-manager";

export const logger = createMiddleware(async (context, next) => {
    if (config.logging.log_requests) {
        await debugRequest(context.req.raw.clone());
    }

    await next();
});
