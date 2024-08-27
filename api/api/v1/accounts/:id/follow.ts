import { apiRoute, applyConfig, auth, handleZodError } from "@/api";
import { zValidator } from "@hono/zod-validator";
import ISO6391 from "iso-639-1";
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
    route: "/api/v1/accounts/:id/follow",
    auth: {
        required: true,
        oauthPermissions: ["write:follows"],
    },
    permissions: {
        required: [
            RolePermissions.ManageOwnFollows,
            RolePermissions.ViewAccounts,
        ],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z
        .object({
            reblogs: z.coerce.boolean().optional(),
            notify: z.coerce.boolean().optional(),
            languages: z
                .array(z.enum(ISO6391.getAllCodes() as [string, ...string[]]))
                .optional(),
        })
        .optional()
        .default({ reblogs: true, notify: false, languages: [] }),
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
            const { reblogs, notify, languages } = context.req.valid("json");

            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            const otherUser = await User.fromId(id);

            if (!otherUser) {
                return context.json({ error: "User not found" }, 404);
            }

            let relationship = await Relationship.fromOwnerAndSubject(
                user,
                otherUser,
            );

            if (!relationship.data.following) {
                relationship = await user.followRequest(otherUser, {
                    reblogs,
                    notify,
                    languages,
                });
            }

            return context.json(relationship.toApi());
        },
    ),
);
