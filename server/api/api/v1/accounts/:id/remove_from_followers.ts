import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { relationshipToAPI } from "~/database/entities/Relationship";
import { getRelationshipToOtherUser } from "~/database/entities/User";
import { db } from "~/drizzle/db";
import { Relationships, RolePermissions } from "~/drizzle/schema";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/remove_from_followers",
    auth: {
        required: true,
        oauthPermissions: ["write:follows"],
    },
    permissions: {
        required: [
            RolePermissions.MANAGE_OWN_FOLLOWS,
            RolePermissions.VIEW_ACCOUNTS,
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

            if (!self) return errorResponse("Unauthorized", 401);

            const otherUser = await User.fromId(id);

            if (!otherUser) return errorResponse("User not found", 404);

            const foundRelationship = await getRelationshipToOtherUser(
                self,
                otherUser,
            );

            if (foundRelationship.followedBy) {
                foundRelationship.followedBy = false;

                await db
                    .update(Relationships)
                    .set({
                        followedBy: false,
                    })
                    .where(eq(Relationships.id, foundRelationship.id));

                if (otherUser.isLocal()) {
                    await db
                        .update(Relationships)
                        .set({
                            following: false,
                        })
                        .where(
                            and(
                                eq(Relationships.ownerId, otherUser.id),
                                eq(Relationships.subjectId, self.id),
                            ),
                        );
                }
            }

            return jsonResponse(relationshipToAPI(foundRelationship));
        },
    );
