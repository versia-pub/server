import { applyConfig, auth, handleZodError, idValidator } from "@api";
import { zValidator } from "@hono/zod-validator";
import { errorResponse, jsonResponse } from "@response";
import { inArray } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { db } from "~drizzle/db";
import { Users } from "~drizzle/schema";
import { User } from "~packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/accounts/familiar_followers",
    ratelimits: {
        max: 5,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:follows"],
    },
});

export const schemas = {
    query: z.object({
        "id[]": z.array(z.string().uuid()).min(1).max(10),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth),
        async (context) => {
            const { user: self } = context.req.valid("header");
            const { "id[]": ids } = context.req.valid("query");

            if (!self) return errorResponse("Unauthorized", 401);

            const idFollowerRelationships =
                await db.query.Relationships.findMany({
                    columns: {
                        ownerId: true,
                    },
                    where: (relationship, { inArray, and, eq }) =>
                        and(
                            inArray(relationship.subjectId, ids),
                            eq(relationship.following, true),
                        ),
                });

            if (idFollowerRelationships.length === 0) {
                return jsonResponse([]);
            }

            // Find users that you follow in idFollowerRelationships
            const relevantRelationships = await db.query.Relationships.findMany(
                {
                    columns: {
                        subjectId: true,
                    },
                    where: (relationship, { inArray, and, eq }) =>
                        and(
                            eq(relationship.ownerId, self.id),
                            inArray(
                                relationship.subjectId,
                                idFollowerRelationships.map((f) => f.ownerId),
                            ),
                            eq(relationship.following, true),
                        ),
                },
            );

            if (relevantRelationships.length === 0) {
                return jsonResponse([]);
            }

            const finalUsers = await User.manyFromSql(
                inArray(
                    Users.id,
                    relevantRelationships.map((r) => r.subjectId),
                ),
            );

            return jsonResponse(finalUsers.map((o) => o.toAPI()));
        },
    );
