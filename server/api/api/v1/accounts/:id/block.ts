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
    route: "/api/v1/accounts/:id/block",
    auth: {
        required: true,
        oauthPermissions: ["write:blocks"],
    },
    permissions: {
        required: [
            RolePermissions.ManageOwnBlocks,
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
            const { user } = context.req.valid("header");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            const otherUser = await User.fromId(id);

            if (!otherUser) {
                return errorResponse("User not found", 404);
            }

            const foundRelationship = await Relationship.fromOwnerAndSubject(
                user,
                otherUser,
            );

            if (!foundRelationship.data.blocking) {
                await foundRelationship.update({
                    blocking: true,
                });
            }

            return jsonResponse(foundRelationship.toApi());
        },
    );
