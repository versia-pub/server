import { auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { RolePermissions } from "~/drizzle/schema";

export const route = createRoute({
    method: "delete",
    path: "/api/v1/push/subscription",
    summary: "Remove current subscription",
    description: "Removes the current Web Push API subscription.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/push/#delete",
    },
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.UsePushNotifications],
            scopes: ["push"],
        }),
    ] as const,
    responses: {
        200: {
            description:
                "PushSubscription successfully deleted or did not exist previously.",
            content: {
                "application/json": {
                    schema: z.object({}),
                },
            },
        },
    },
});
