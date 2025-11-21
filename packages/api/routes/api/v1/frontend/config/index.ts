import { config } from "@versia-server/config";
import { apiRoute } from "@versia-server/kit/api";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";

export default apiRoute((app) =>
    app.get(
        "/api/v1/frontend/config",
        describeRoute({
            summary: "Get frontend config",
            responses: {
                200: {
                    description: "Frontend config",
                    content: {
                        "application/json": {
                            schema: resolver(
                                z.record(z.string(), z.any()).default({}),
                            ),
                        },
                    },
                },
            },
        }),
        (context) => {
            return context.json(config.frontend.settings, 200);
        },
    ),
);
