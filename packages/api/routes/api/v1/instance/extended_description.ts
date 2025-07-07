import { ExtendedDescription as ExtendedDescriptionSchema } from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { apiRoute } from "@versia-server/kit/api";
import { markdownToHtml } from "@versia-server/kit/markdown";
import { describeRoute, resolver } from "hono-openapi";

export default apiRoute((app) =>
    app.get(
        "/api/v1/instance/extended_description",
        describeRoute({
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
                            schema: resolver(ExtendedDescriptionSchema),
                        },
                    },
                },
            },
        }),
        async (context) => {
            const content = await markdownToHtml(
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
        },
    ),
);
