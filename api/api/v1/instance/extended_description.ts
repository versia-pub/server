import { apiRoute } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { ExtendedDescription as ExtendedDescriptionSchema } from "@versia/client/schemas";
import { markdownParse } from "~/classes/functions/status";
import { config } from "~/config.ts";

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
        const content = await markdownParse(
            config.instance.extended_description_path?.content ??
                "This is a [Versia](https://versia.pub) server with the default extended description.",
        );

        return context.json(
            {
                updated_at: new Date(
                    config.instance.extended_description_path?.file
                        .lastModified ?? 0,
                ).toISOString(),
                content,
            },
            200,
        );
    }),
);
