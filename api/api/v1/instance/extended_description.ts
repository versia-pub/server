import { apiRoute } from "@/api";
import { renderMarkdownInPath } from "@/markdown";
import { createRoute } from "@hono/zod-openapi";
import { ExtendedDescription as ExtendedDescriptionSchema } from "~/classes/schemas/extended-description";
import { config } from "~/packages/config-manager";

const route = createRoute({
    method: "get",
    path: "/api/v1/instance/extended_description",
    summary: "View extended description",
    description: "Obtain an extended description of this server",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/instance/#extended_description",
    },
    tags: ["Instance"],
    responses: {
        200: {
            description: "Server extended description",
            content: {
                "application/json": {
                    schema: ExtendedDescriptionSchema,
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
