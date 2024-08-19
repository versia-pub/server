import { apiRoute, applyConfig, auth, handleZodError } from "@/api";
import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { RolePermissions, Users } from "~/drizzle/schema";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/id",
    auth: {
        required: false,
        oauthPermissions: [],
    },
    permissions: {
        required: [RolePermissions.Search],
    },
});

export const schemas = {
    query: z.object({
        username: z.string().min(1).max(512),
    }),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { username } = context.req.valid("query");

            const user = await User.fromSql(
                and(eq(Users.username, username), isNull(Users.instanceId)),
            );

            if (!user) {
                return context.json({ error: "User not found" }, 404);
            }

            return context.json(user.toApi());
        },
    ),
);
