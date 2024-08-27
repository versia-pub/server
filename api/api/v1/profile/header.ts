import { apiRoute, applyConfig, auth } from "@/api";
import { RolePermissions } from "~/drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["DELETE"],
    ratelimits: {
        max: 10,
        duration: 60,
    },
    route: "/api/v1/profile/header",
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnAccount],
    },
});

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user: self } = context.get("auth");

            if (!self) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            await self.update({
                header: "",
            });

            return context.json(self.toApi(true));
        },
    ),
);
