import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
    checkForBidirectionalRelationships,
    relationshipToApi,
} from "~/classes/functions/relationship";
import {
    getRelationshipToOtherUser,
    sendFollowReject,
} from "~/classes/functions/user";
import { db } from "~/drizzle/db";
import { Relationships, RolePermissions } from "~/drizzle/schema";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    route: "/api/v1/follow_requests/:account_id/reject",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnFollows],
    },
});

export const schemas = {
    param: z.object({
        account_id: z.string().uuid(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user } = context.req.valid("header");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            const { account_id } = context.req.valid("param");

            const account = await User.fromId(account_id);

            if (!account) {
                return errorResponse("Account not found", 404);
            }

            // Check if there is a relationship on both sides
            await checkForBidirectionalRelationships(user, account);

            // Reject follow request
            await db
                .update(Relationships)
                .set({
                    requested: false,
                    following: false,
                })
                .where(
                    and(
                        eq(Relationships.subjectId, user.id),
                        eq(Relationships.ownerId, account.id),
                    ),
                );

            // Update followedBy for other user
            await db
                .update(Relationships)
                .set({
                    followedBy: false,
                    requestedBy: false,
                })
                .where(
                    and(
                        eq(Relationships.subjectId, account.id),
                        eq(Relationships.ownerId, user.id),
                    ),
                );

            const foundRelationship = await getRelationshipToOtherUser(
                user,
                account,
            );

            if (!foundRelationship) {
                return errorResponse("Relationship not found", 404);
            }

            // Check if rejecting remote follow
            if (account.isRemote()) {
                // Federate follow reject
                await sendFollowReject(account, user);
            }

            return jsonResponse(relationshipToApi(foundRelationship));
        },
    );
