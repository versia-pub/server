import { apiRoute, auth } from "@/api";
import { renderMarkdownInPath } from "@/markdown";
import { createRoute } from "@hono/zod-openapi";
import { TermsOfService as TermsOfServiceSchema } from "~/classes/schemas/tos";
import { config } from "~/packages/config-manager";

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
