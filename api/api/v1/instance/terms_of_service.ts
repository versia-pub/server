import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { TermsOfService as TermsOfServiceSchema } from "@versia/client/schemas";
import { markdownParse } from "~/classes/functions/status";
import { config } from "~/config.ts";

const route = createRoute({
    method: "get",
    path: "/api/v1/instance/terms_of_service",
    summary: "View terms of service",
    description:
        "Obtain the contents of this server’s terms of service, if configured.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/instance/#terms_of_service",
    },
    tags: ["Instance"],
    middleware: [
        auth({
            auth: false,
        }),
    ],
    responses: {
        200: {
            description: "Server terms of service",
            content: {
                "application/json": {
                    schema: TermsOfServiceSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
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
    }),
);
