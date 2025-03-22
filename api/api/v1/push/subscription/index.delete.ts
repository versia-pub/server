import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { RolePermission } from "@versia/client/schemas";
import { PushSubscription } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

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
            tags: ["Push Notifications"],
            middleware: [
                auth({
                    auth: true,
                    permissions: [RolePermission.UsePushNotifications],
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
                ...reusedResponses,
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
