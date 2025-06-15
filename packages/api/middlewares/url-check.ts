import { config } from "@versia-server/config";
import { createMiddleware } from "hono/factory";

export const urlCheck = createMiddleware(async (context, next) => {
    // Check that request URL matches base_url
    const baseUrl = config.http.base_url;

    if (new URL(context.req.url).origin !== baseUrl.origin) {
        return context.json(
            {
                error: `Request URL ${context.req.url} does not match base URL ${baseUrl.origin}`,
            },
            400,
        );
    }

    await next();
    return;
});
