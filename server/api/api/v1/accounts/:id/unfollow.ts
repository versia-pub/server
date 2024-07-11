import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
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
    route: "/api/v1/accounts/:id/unfollow",
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

            const otherUser = await User.fromId(id);

            if (!otherUser) {
                return errorResponse("User not found", 404);
            }

            const foundRelationship = await getRelationshipToOtherUser(
                self,
                otherUser,
            );

            if (foundRelationship.following) {
                foundRelationship.following = false;

                await db
                    .update(Relationships)
                    .set({
                        following: false,
                        requested: false,
                    })
                    .where(eq(Relationships.id, foundRelationship.id));
            }

            return jsonResponse(relationshipToApi(foundRelationship));
        },
    );
