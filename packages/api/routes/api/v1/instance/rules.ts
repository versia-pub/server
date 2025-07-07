import { Rule as RuleSchema } from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { apiRoute } from "@versia-server/kit/api";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.get(
        "/api/v1/instance/rules",
        describeRoute({
            summary: "List of rules",
            description: "Rules that the users of this service should follow.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/instance/#rules",
            },
            tags: ["Instance"],
            responses: {
                200: {
                    description: "Instance rules",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(RuleSchema)),
                        },
                    },
                },
            },
        }),
        (context) => {
            return context.json(
                config.instance.rules.map((r, index) => ({
                    id: String(index),
                    text: r.text,
                    hint: r.hint,
                })),
            );
        },
    ),
);
