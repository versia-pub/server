import { apiRoute } from "@versia/kit/api";
import { Note, User } from "@versia/kit/db";
import { config } from "@versia-server/config";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import manifest from "~/package.json" with { type: "json" };

export default apiRoute((app) =>
    app.get(
        "/.well-known/nodeinfo/2.0",
        describeRoute({
            summary: "Well-known nodeinfo 2.0",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Nodeinfo 2.0",
                    content: {
                        "application/json": {
                            schema: resolver(
                                z.object({
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
                            ),
                        },
                    },
                },
            },
        }),
        async (context) => {
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
                openRegistrations: config.registration.allow,
                metadata: {
                    nodeName: config.instance.name,
                    nodeDescription: config.instance.description,
                },
            });
        },
    ),
);
