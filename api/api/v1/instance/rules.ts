import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Rule as RuleSchema } from "@versia/client/schemas";
import { config } from "~/config.ts";

const route = createRoute({
    method: "get",
    path: "/api/v1/instance/rules",
    summary: "List of rules",
    description: "Rules that the users of this service should follow.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/instance/#rules",
    },
    tags: ["Instance"],
    middleware: [
        auth({
            auth: false,
        }),
    ],
    responses: {
        200: {
            description: "Instance rules",
            content: {
                "application/json": {
                    schema: z.array(RuleSchema),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, (context) => {
        return context.json(
            config.instance.rules.map((r, index) => ({
                id: String(index),
                text: r.text,
                hint: r.hint,
            })),
        );
    }),
);
