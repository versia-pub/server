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
    route: "/api/v1/accounts/:id/block",
    auth: {
        required: true,
        oauthPermissions: ["write:blocks"],
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
        auth(meta.auth),
        async (context) => {
            const { id } = context.req.valid("param");
            const { user } = context.req.valid("header");

            if (!user) return errorResponse("Unauthorized", 401);

            const otherUser = await User.fromId(id);

            if (!otherUser) return errorResponse("User not found", 404);

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

            return jsonResponse(relationshipToAPI(foundRelationship));
        },
    );
