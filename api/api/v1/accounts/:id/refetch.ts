import { apiRoute, applyConfig, auth, handleZodError } from "@/api";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 4,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/refetch",
    auth: {
        required: true,
        oauthPermissions: ["write:accounts"],
    },
    permissions: {
        required: [RolePermissions.ViewAccounts],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");
            const { user } = context.req.valid("header");

            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            const otherUser = await User.fromId(id);

            if (!otherUser) {
                return context.json({ error: "User not found" }, 404);
            }

            const newUser = await otherUser.updateFromRemote();

            return context.json(newUser.toApi(false));
        },
    ),
);