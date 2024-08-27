import { apiRoute, applyConfig, auth, handleZodError } from "@/api";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { Relationship } from "~/packages/database-interface/relationship";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/note",
    auth: {
        required: true,
        oauthPermissions: ["write:accounts"],
    },
    permissions: {
        required: [
            RolePermissions.ManageOwnAccount,
            RolePermissions.ViewAccounts,
        ],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z.object({
        comment: z.string().min(0).max(5000).trim().optional(),
    }),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        zValidator("json", schemas.json, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");
            const { user } = context.get("auth");
            const { comment } = context.req.valid("json");

            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            const otherUser = await User.fromId(id);

            if (!otherUser) {
                return context.json({ error: "User not found" }, 404);
            }

            const foundRelationship = await Relationship.fromOwnerAndSubject(
                user,
                otherUser,
            );

            await foundRelationship.update({
                note: comment,
            });

            return context.json(foundRelationship.toApi());
        },
    ),
);
