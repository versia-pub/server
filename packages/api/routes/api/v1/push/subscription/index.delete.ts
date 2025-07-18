import { RolePermission } from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth } from "@versia-server/kit/api";
import { PushSubscription } from "@versia-server/kit/db";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.delete(
        "/api/v1/push/subscription",
        describeRoute({
            summary: "Remove current subscription",
            description: "Removes the current Web Push API subscription.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/push/#delete",
            },
            tags: ["Push Notifications"],
            responses: {
                200: {
                    description:
                        "PushSubscription successfully deleted or did not exist previously.",
                    content: {
                        "application/json": {
                            schema: resolver(z.object({})),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.UsePushNotifications],
            scopes: ["push"],
        }),
        async (context) => {
            const { token } = context.get("auth");

            const ps = await PushSubscription.fromToken(token);

            if (!ps) {
                throw ApiError.pushSubscriptionNotFound();
            }

            await ps.delete();

            return context.json({}, 200);
        },
    ),
);
