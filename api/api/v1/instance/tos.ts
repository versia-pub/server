import { apiRoute, applyConfig, auth } from "@/api";
import { renderMarkdownInPath } from "@/markdown";
import { createRoute, z } from "@hono/zod-openapi";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    route: "/api/v1/instance/tos",
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
    path: "/api/v1/instance/tos",
    summary: "Get instance terms of service",
    middleware: [auth(meta.auth)],
    responses: {
        200: {
            description: "Instance terms of service",
            content: {
                "application/json": {
                    schema: z.object({
                        updated_at: z.string(),
                        content: z.string(),
                    }),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { content, lastModified } = await renderMarkdownInPath(
            config.instance.tos_path ?? "",
            "This instance has not provided any terms of service.",
        );

        return context.json({
            updated_at: lastModified.toISOString(),
            content,
        });
    }),
);
