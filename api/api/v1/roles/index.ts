import { apiRoute, applyConfig, auth } from "@/api";
import { Role } from "~/packages/database-interface/role";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: true,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/api/v1/roles",
});

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user } = context.get("auth");

            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            const userRoles = await Role.getUserRoles(
                user.id,
                user.data.isAdmin,
            );

            return context.json(userRoles.map((r) => r.toApi()));
        },
    ),
);
