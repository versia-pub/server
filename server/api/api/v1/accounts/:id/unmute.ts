import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
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
    route: "/api/v1/accounts/:id/unmute",
    auth: {
        required: true,
        oauthPermissions: ["write:mutes"],
    },
    permissions: {
        required: [
            RolePermissions.ManageOwnMutes,
            RolePermissions.ViewAccounts,
        ],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");
            const { user: self } = context.req.valid("header");

            if (!self) {
                return errorResponse("Unauthorized", 401);
            }

            const user = await User.fromId(id);

            if (!user) {
                return errorResponse("User not found", 404);
            }

            const foundRelationship = await Relationship.fromOwnerAndSubject(
                self,
                user,
            );

            if (foundRelationship.data.muting) {
                await foundRelationship.update({
                    muting: false,
                    mutingNotifications: false,
                });
            }

            return jsonResponse(foundRelationship.toApi());
        },
    );
