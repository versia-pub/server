import { apiRoute, applyConfig, auth } from "@/api";
import { renderMarkdownInPath } from "@/markdown";
import { createRoute, z } from "@hono/zod-openapi";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/instance/privacy_policy",
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
    path: "/api/v1/instance/privacy_policy",
    summary: "Get instance privacy policy",
    middleware: [auth(meta.auth)],
    responses: {
        200: {
            description: "Instance privacy policy",
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
            config.instance.privacy_policy_path ?? "",
            "This instance has not provided any privacy policy.",
        );

        return context.json({
            updated_at: lastModified.toISOString(),
            content,
        });
    }),
);
