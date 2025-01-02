import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { PushSubscription } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";
import { RolePermissions } from "~/drizzle/schema";

export default apiRoute((app) =>
    app.openapi(
        createRoute({
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
        }),
        async (context) => {
            const { token } = context.get("auth");

            const ps = await PushSubscription.fromToken(token);

            if (!ps) {
                throw new ApiError(
                    404,
                    "No push subscription associated with this access token",
                );
            }

            await ps.delete();

            return context.json({}, 200);
        },
    ),
);
