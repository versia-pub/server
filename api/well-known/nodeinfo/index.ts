import { apiRoute, applyConfig } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 60,
    },
    route: "/.well-known/nodeinfo",
});

const route = createRoute({
    method: "get",
    path: "/.well-known/nodeinfo",
    summary: "Well-known nodeinfo",
    responses: {
        301: {
            description: "Redirect to 2.0 Nodeinfo",
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, (context) => {
        return context.redirect(
            new URL(
                "/.well-known/nodeinfo/2.0",
                config.http.base_url,
            ).toString(),
            301,
        );
    }),
);
