import { apiRoute, applyConfig } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 120,
    },
    route: "/api/v1/frontend/config",
});

const route = createRoute({
    method: "get",
    path: "/api/v1/frontend/config",
    summary: "Get frontend config",
    responses: {
        200: {
            description: "Frontend config",
            content: {
                "application/json": {
                    schema: z.record(z.string(), z.any()).default({}),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, (context) => {
        return context.json(config.frontend.settings, 200);
    }),
);
