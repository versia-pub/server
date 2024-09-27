import { apiRoute, applyConfig } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import manifest from "~/package.json";

export const meta = applyConfig({
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/.well-known/nodeinfo/2.0",
});

const route = createRoute({
    method: "get",
    path: "/.well-known/nodeinfo/2.0",
    summary: "Well-known nodeinfo 2.0",
    responses: {
        200: {
            description: "Nodeinfo 2.0",
            content: {
                "application/json": {
                    schema: z.object({
                        version: z.string(),
                        software: z.object({
                            name: z.string(),
                            version: z.string(),
                        }),
                        protocols: z.array(z.string()),
                        services: z.object({
                            outbound: z.array(z.string()),
                            inbound: z.array(z.string()),
                        }),
                        usage: z.object({
                            users: z.object({
                                total: z.number(),
                                activeMonth: z.number(),
                                activeHalfyear: z.number(),
                            }),
                            localPosts: z.number(),
                        }),
                        openRegistrations: z.boolean(),
                        metadata: z.object({}),
                    }),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, (context) => {
        return context.json({
            version: "2.0",
            software: { name: "versia-server", version: manifest.version },
            protocols: ["versia"],
            services: { outbound: [], inbound: [] },
            usage: {
                users: { total: 0, activeMonth: 0, activeHalfyear: 0 },
                localPosts: 0,
            },
            openRegistrations: false,
            metadata: {},
        });
    }),
);
