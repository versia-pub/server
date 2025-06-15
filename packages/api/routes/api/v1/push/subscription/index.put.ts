import {
    RolePermission,
    WebPushSubscriptionInput,
    WebPushSubscription as WebPushSubscriptionSchema,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import {
    apiRoute,
    auth,
    handleZodError,
    jsonOrForm,
} from "@versia-server/kit/api";
import { PushSubscription } from "@versia-server/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";

export default apiRoute((app) =>
    app.put(
        "/api/v1/push/subscription",
        describeRoute({
            summary: "Change types of notifications",
            description:
                "Updates the current push subscription. Only the data part can be updated. To change fundamentals, a new subscription must be created instead.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/push/#update",
            },
            tags: ["Push Notifications"],
            responses: {
                200: {
                    description: "The WebPushSubscription has been updated.",
                    content: {
                        "application/json": {
                            schema: resolver(WebPushSubscriptionSchema),
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
        jsonOrForm(),
        validator(
            "json",
            WebPushSubscriptionInput.pick({
                data: true,
                policy: true,
            }),
            handleZodError,
        ),
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
