import { config } from "@versia-server/config";
import { apiRoute } from "@versia-server/kit/api";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";

export default apiRoute((app) =>
    app.get(
        "/.well-known/nodeinfo",
        describeRoute({
            summary: "Well-known nodeinfo",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Nodeinfo links",
                    content: {
                        "application/json": {
                            schema: resolver(
                                z.object({
                                    links: z.array(
                                        z.object({
                                            rel: z.string(),
                                            href: z.string(),
                                        }),
                                    ),
                                }),
                            ),
                        },
                    },
                },
            },
        }),
        (context) => {
            return context.json({
                links: [
                    {
                        rel: "http://nodeinfo.diaspora.software/ns/schema/2.0",
                        href: new URL(
                            "/.well-known/nodeinfo/2.0",
                            config.http.base_url,
                        ).toString(),
                    },
                ],
            });
        },
    ),
);
