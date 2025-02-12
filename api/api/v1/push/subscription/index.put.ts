import { apiRoute, auth, jsonOrForm } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { PushSubscription } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";
import {
    WebPushSubscriptionInput,
    WebPushSubscription as WebPushSubscriptionSchema,
} from "~/classes/schemas/pushsubscription";
import { RolePermissions } from "~/drizzle/schema";

export default apiRoute((app) =>
    app.openapi(
        createRoute({
            method: "put",
            path: "/api/v1/push/subscription",
            summary: "Change types of notifications",
            description:
                "Updates the current push subscription. Only the data part can be updated. To change fundamentals, a new subscription must be created instead.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/push/#update",
            },
            middleware: [
                auth({
                    auth: true,
                    permissions: [RolePermissions.UsePushNotifications],
                    scopes: ["push"],
                }),
                jsonOrForm(),
            ] as const,
            request: {
                body: {
                    content: {
                        "application/json": {
                            schema: WebPushSubscriptionInput.pick({
                                data: true,
                                policy: true,
                            }),
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "The WebPushSubscription has been updated.",
                    content: {
                        "application/json": {
                            schema: WebPushSubscriptionSchema,
                        },
                    },
                },
            },
        }),
        async (context) => {
            const { user, token } = context.get("auth");
            const { data, policy } = context.req.valid("json");

            const ps = await PushSubscription.fromToken(token);

            if (!ps) {
                throw new ApiError(
                    404,
                    "No push subscription associated with this access token",
                );
            }

            if (
                data.alerts["admin.report"] &&
                !user.hasPermission(RolePermissions.ManageReports)
            ) {
                // This shouldn't throw an error in mastodon either
                data.alerts["admin.report"] = false;
            }

            if (
                data.alerts["admin.sign_up"] &&
                !user.hasPermission(RolePermissions.ManageAccounts)
            ) {
                data.alerts["admin.sign_up"] = false;
            }

            await ps.update({
                policy,
                alerts: {
                    ...ps.data.alerts,
                    ...data.alerts,
                },
            });

            return context.json(ps.toApi(), 200);
        },
    ),
);
