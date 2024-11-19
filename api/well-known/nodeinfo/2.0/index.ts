import { apiRoute, applyConfig } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Note, User } from "@versia/kit/db";
import manifest from "~/package.json";
import { config } from "~/packages/config-manager";

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
    app.openapi(route, async (context) => {
        const userCount = await User.getCount();
        const userActiveMonth = await User.getActiveInPeriod(
            1000 * 60 * 60 * 24 * 30,
        );
        const userActiveHalfyear = await User.getActiveInPeriod(
            1000 * 60 * 60 * 24 * 30 * 6,
        );
        const noteCount = await Note.getCount();

        return context.json({
            version: "2.0",
            software: { name: "versia-server", version: manifest.version },
            protocols: ["versia"],
            services: { outbound: [], inbound: [] },
            usage: {
                users: {
                    total: userCount,
                    activeMonth: userActiveMonth,
                    activeHalfyear: userActiveHalfyear,
                },
                localPosts: noteCount,
            },
            openRegistrations: config.signups.registration,
            metadata: {
                nodeName: config.instance.name,
                nodeDescription: config.instance.description,
            },
        });
    }),
);
