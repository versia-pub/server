import { PrivacyPolicy as PrivacyPolicySchema } from "@versia/client/schemas";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { apiRoute } from "@/api";
import { markdownParse } from "~/classes/functions/status";
import { config } from "~/config.ts";

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
        },
    ),
);
