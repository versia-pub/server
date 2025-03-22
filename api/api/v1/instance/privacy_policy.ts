import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { PrivacyPolicy as PrivacyPolicySchema } from "@versia/client-ng/schemas";
import { markdownParse } from "~/classes/functions/status";
import { config } from "~/config.ts";

const route = createRoute({
    method: "get",
    path: "/api/v1/instance/privacy_policy",
    summary: "View privacy policy",
    description: "Obtain the contents of this server’s privacy policy.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/instance/#privacy_policy",
    },
    tags: ["Instance"],
    middleware: [
        auth({
            auth: false,
        }),
    ],
    responses: {
        200: {
            description: "Server privacy policy",
            content: {
                "application/json": {
                    schema: PrivacyPolicySchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const content = await markdownParse(
            config.instance.privacy_policy_path?.content ??
                "This instance has not provided any privacy policy.",
        );

        return context.json({
            updated_at: new Date(
                config.instance.privacy_policy_path?.file.lastModified ?? 0,
            ).toISOString(),
            content,
        });
    }),
);
