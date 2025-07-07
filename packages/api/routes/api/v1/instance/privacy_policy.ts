import { PrivacyPolicy as PrivacyPolicySchema } from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { apiRoute } from "@versia-server/kit/api";
import { markdownToHtml } from "@versia-server/kit/markdown";
import { describeRoute, resolver } from "hono-openapi";

export default apiRoute((app) =>
    app.get(
        "/api/v1/instance/privacy_policy",
        describeRoute({
            summary: "View privacy policy",
            description: "Obtain the contents of this server’s privacy policy.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/instance/#privacy_policy",
            },
            tags: ["Instance"],
            responses: {
                200: {
                    description: "Server privacy policy",
                    content: {
                        "application/json": {
                            schema: resolver(PrivacyPolicySchema),
                        },
                    },
                },
            },
        }),
        async (context) => {
            const content = await markdownToHtml(
                config.instance.privacy_policy_path?.content ??
                    "This instance has not provided any privacy policy.",
            );

            return context.json({
                updated_at: new Date(
                    config.instance.privacy_policy_path?.file.lastModified ?? 0,
                ).toISOString(),
                content,
            });
        },
    ),
);
