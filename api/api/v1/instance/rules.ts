import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/instance/rules",
    ratelimits: {
        max: 300,
        duration: 60,
    },
    auth: {
        required: false,
    },
});

const route = createRoute({
    method: "get",
    path: "/api/v1/instance/rules",
    summary: "Get instance rules",
    middleware: [auth(meta.auth)],
    responses: {
        200: {
            description: "Instance rules",
            content: {
                "application/json": {
                    schema: z.array(
                        z.object({
                            id: z.string(),
                            text: z.string(),
                            hint: z.string(),
                        }),
                    ),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        return context.json(
            config.signups.rules.map((rule, index) => ({
                id: String(index),
                text: rule,
                hint: "",
            })),
        );
    }),
);
