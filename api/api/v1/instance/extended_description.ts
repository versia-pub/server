import { apiRoute, applyConfig } from "@/api";
import { renderMarkdownInPath } from "@/markdown";
import { createRoute, z } from "@hono/zod-openapi";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    route: "/api/v1/instance/extended_description",
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
    path: "/api/v1/instance/extended_description",
    summary: "Get extended description",
    responses: {
        200: {
            description: "Extended description",
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
            config.instance.extended_description_path ?? "",
            "This is a [Versia](https://versia.pub) server with the default extended description.",
        );

        return context.json(
            {
                updated_at: lastModified.toISOString(),
                content,
            },
            200,
        );
    }),
);
