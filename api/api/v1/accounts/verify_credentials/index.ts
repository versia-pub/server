import { apiRoute, applyConfig, auth } from "@/api";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/accounts/verify_credentials",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:accounts"],
    },
});

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        (context) => {
            // TODO: Add checks for disabled/unverified accounts
            const { user } = context.get("auth");

            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            return context.json(user.toApi(true));
        },
    ),
);
