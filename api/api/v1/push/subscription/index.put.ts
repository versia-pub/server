import { apiRoute } from "@/api";
import { PushSubscription } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";
import { RolePermissions } from "~/drizzle/schema";
import { route } from "./index.put.schema";

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user, token } = context.get("auth");
        const { alerts, policy } = context.req.valid("json");

        const ps = await PushSubscription.fromToken(token);

        if (!ps) {
            throw new ApiError(
                404,
                "No push subscription associated with this access token",
            );
        }

        if (
            alerts["admin.report"] &&
            !user.hasPermission(RolePermissions.ManageReports)
        ) {
            throw new ApiError(
                403,
                `You do not have the '${RolePermissions.ManageReports}' permission to receive report alerts`,
            );
        }

        if (
            alerts["admin.sign_up"] &&
            !user.hasPermission(RolePermissions.ManageAccounts)
        ) {
            throw new ApiError(
                403,
                `You do not have the '${RolePermissions.ManageAccounts}' permission to receive sign-up alerts`,
            );
        }

        await ps.update({
            policy,
            alerts: {
                ...ps.data.alerts,
                ...alerts,
            },
        });

        return context.json(ps.toApi(), 200);
    }),
);
