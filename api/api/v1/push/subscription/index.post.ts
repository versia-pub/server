import { apiRoute } from "@/api";
import { PushSubscription } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";
import { RolePermissions } from "~/drizzle/schema";
import { route } from "./index.post.schema";

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user, token } = context.get("auth");
        const { subscription, data } = context.req.valid("json");

        if (
            data.alerts["admin.report"] &&
            !user.hasPermission(RolePermissions.ManageReports)
        ) {
            throw new ApiError(
                403,
                `You do not have the '${RolePermissions.ManageReports}' permission to receive report alerts`,
            );
        }

        if (
            data.alerts["admin.sign_up"] &&
            !user.hasPermission(RolePermissions.ManageAccounts)
        ) {
            throw new ApiError(
                403,
                `You do not have the '${RolePermissions.ManageAccounts}' permission to receive sign-up alerts`,
            );
        }

        await PushSubscription.clearAllOfToken(token);

        const ps = await PushSubscription.insert({
            alerts: data.alerts,
            policy: data.policy,
            endpoint: subscription.endpoint,
            publicKey: subscription.keys.p256dh,
            authSecret: subscription.keys.auth,
            tokenId: token.id,
        });

        return context.json(ps.toApi(), 200);
    }),
);
