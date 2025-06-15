import { TermsOfService as TermsOfServiceSchema } from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { apiRoute } from "@versia-server/kit/api";
import { markdownToHtml } from "@versia-server/kit/markdown";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";

export default apiRoute((app) =>
    app.get(
        "/api/v1/instance/terms_of_service",
        describeRoute({
            summary: "View terms of service",
            description:
                "Obtain the contents of this server’s terms of service, if configured.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/instance/#terms_of_service",
            },
            tags: ["Instance"],
            responses: {
                200: {
                    description: "Server terms of service",
                    content: {
                        "application/json": {
                            schema: resolver(TermsOfServiceSchema),
                        },
                    },
                },
            },
        }),
        async (context) => {
            const content = await markdownToHtml(
                config.instance.tos_path?.content ??
                    "This instance has not provided any terms of service.",
            );

            return context.json({
                updated_at: new Date(
                    config.instance.tos_path?.file.lastModified ?? 0,
                ).toISOString(),
                content,
            });
        },
    ),
);
