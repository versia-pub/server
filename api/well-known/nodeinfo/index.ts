import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { config } from "~/config.ts";

const route = createRoute({
    method: "get",
    path: "/.well-known/nodeinfo",
    summary: "Well-known nodeinfo",
    responses: {
        200: {
            description: "Nodeinfo links",
            content: {
                "application/json": {
                    schema: z.object({
                        links: z.array(
                            z.object({
                                rel: z.string(),
                                href: z.string(),
                            }),
                        ),
                    }),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, (context) => {
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
    }),
);
