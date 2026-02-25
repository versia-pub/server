import { apiRoute } from "@versia-server/kit/api";
import { describeRoute, resolver } from "hono-openapi";
import z from "zod";

export default apiRoute((app) =>
    app.get(
        "/.well-known/versia",
        describeRoute({
            summary: "Get supported versia protocol versions",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Instance metadata",
                    content: {
                        "application/json": {
                            schema: resolver(
                                z.strictObject({
                                    versions: z.array(z.string().min(1)),
                                }),
                            ),
                        },
                    },
                },
            },
        }),
        (context) => {
            return context.json(
                {
                    versions: ["0.6.0"],
                },
                200,
            );
        },
    ),
);
