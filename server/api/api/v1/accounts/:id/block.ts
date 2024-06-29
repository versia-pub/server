import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { relationshipToApi } from "~/classes/functions/relationship";
import { getRelationshipToOtherUser } from "~/classes/functions/user";
import { db } from "~/drizzle/db";
import { Relationships, RolePermissions } from "~/drizzle/schema";
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

            const foundRelationship = await getRelationshipToOtherUser(
                user,
                otherUser,
            );

            if (!foundRelationship.blocking) {
                foundRelationship.blocking = true;
            }

            await db
                .update(Relationships)
                .set({
                    blocking: true,
                })
                .where(eq(Relationships.id, foundRelationship.id));

            return jsonResponse(relationshipToApi(foundRelationship));
        },
    );
