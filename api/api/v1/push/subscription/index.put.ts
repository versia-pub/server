import { apiRoute, auth, jsonOrForm } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import {
    WebPushSubscriptionInput,
    WebPushSubscription as WebPushSubscriptionSchema,
} from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { PushSubscription } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

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
            tags: ["Push Notifications"],
            middleware: [
                auth({
                    auth: true,
                    permissions: [RolePermission.UsePushNotifications],
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
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        async (context) => {
            const { user, token } = context.get("auth");
            const { data, policy } = context.req.valid("json");

            const ps = await PushSubscription.fromToken(token);

            if (!ps) {
                throw ApiError.pushSubscriptionNotFound();
            }

            if (
                data.alerts["admin.report"] &&
                !user.hasPermission(RolePermission.ManageReports)
            ) {
                // This shouldn't throw an error in mastodon either
                data.alerts["admin.report"] = false;
            }

            if (
                data.alerts["admin.sign_up"] &&
                !user.hasPermission(RolePermission.ManageAccounts)
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
