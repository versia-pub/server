import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { relationshipToAPI } from "~/database/entities/Relationship";
import { getRelationshipToOtherUser } from "~/database/entities/User";
import { db } from "~/drizzle/db";
import { Relationships } from "~/drizzle/schema";
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
            const { user: self } = context.req.valid("header");

            if (!self) return errorResponse("Unauthorized", 401);

            const user = await User.fromId(id);

            if (!user) return errorResponse("User not found", 404);

            const foundRelationship = await getRelationshipToOtherUser(
                self,
                user,
            );

            if (foundRelationship.muting) {
                foundRelationship.muting = false;
                foundRelationship.mutingNotifications = false;

                await db
                    .update(Relationships)
                    .set({
                        muting: false,
                        mutingNotifications: false,
                    })
                    .where(eq(Relationships.id, foundRelationship.id));
            }

            return jsonResponse(relationshipToAPI(foundRelationship));
        },
    );
