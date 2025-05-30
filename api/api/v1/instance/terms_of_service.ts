import { TermsOfService as TermsOfServiceSchema } from "@versia/client/schemas";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { apiRoute } from "@/api";
import { markdownParse } from "~/classes/functions/status";
import { config } from "~/config.ts";

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
            const content = await markdownParse(
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
