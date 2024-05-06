import { applyConfig, auth, handleZodError } from "@api";
import { zValidator } from "@hono/zod-validator";
import { errorResponse, jsonResponse } from "@response";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { relationshipToAPI } from "~database/entities/Relationship";
import { getRelationshipToOtherUser } from "~database/entities/User";
import { db } from "~drizzle/db";
import { Relationships } from "~drizzle/schema";
import { User } from "~packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/mute",
    auth: {
        required: true,
        oauthPermissions: ["write:mutes"],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z.object({
        notifications: z.boolean().optional(),
        duration: z
            .number()
            .int()
            .min(60)
            .max(60 * 60 * 24 * 365 * 5)
            .optional(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        zValidator("json", schemas.json, handleZodError),
        auth(meta.auth),
        async (context) => {
            const { id } = context.req.valid("param");
            const { user } = context.req.valid("header");
            const { notifications, duration } = context.req.valid("json");

            if (!user) return errorResponse("Unauthorized", 401);

            const otherUser = await User.fromId(id);

            if (!otherUser) return errorResponse("User not found", 404);

            const foundRelationship = await getRelationshipToOtherUser(
                user,
                otherUser,
            );

            if (!foundRelationship.muting) {
                foundRelationship.muting = true;
            }
            if (notifications ?? true) {
                foundRelationship.mutingNotifications = true;
            }

            await db
                .update(Relationships)
                .set({
                    muting: true,
                    mutingNotifications: notifications ?? true,
                })
                .where(eq(Relationships.id, foundRelationship.id));

            // TODO: Implement duration

            return jsonResponse(relationshipToAPI(foundRelationship));
        },
    );
