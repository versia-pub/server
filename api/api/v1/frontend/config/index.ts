import { apiRoute } from "@/api";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { config } from "~/config.ts";

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
