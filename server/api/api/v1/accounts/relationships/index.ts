import { applyConfig, auth, handleZodError, qsQuery } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import {
    createNewRelationship,
    relationshipToApi,
} from "~/classes/functions/relationship";
import { db } from "~/drizzle/db";
import { RolePermissions } from "~/drizzle/schema";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/accounts/relationships",
    ratelimits: {
        max: 30,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:follows"],
    },
    permissions: {
        required: [RolePermissions.ManageOwnFollows],
    },
});

export const schemas = {
    query: z.object({
        id: z.array(z.string().uuid()).min(1).max(10).or(z.string().uuid()),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        qsQuery(),
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user: self } = context.req.valid("header");
            const { id } = context.req.valid("query");

            const ids = Array.isArray(id) ? id : [id];

            if (!self) {
                return errorResponse("Unauthorized", 401);
            }

            const relationships = await db.query.Relationships.findMany({
                where: (relationship, { inArray, and, eq }) =>
                    and(
                        inArray(relationship.subjectId, ids),
                        eq(relationship.ownerId, self.id),
                    ),
            });

            const missingIds = ids.filter(
                (id) => !relationships.some((r) => r.subjectId === id),
            );

            for (const id of missingIds) {
                const user = await User.fromId(id);
                if (!user) {
                    continue;
                }
                const relationship = await createNewRelationship(self, user);

                relationships.push(relationship);
            }

            relationships.sort(
                (a, b) => ids.indexOf(a.subjectId) - ids.indexOf(b.subjectId),
            );

            return jsonResponse(relationships.map((r) => relationshipToApi(r)));
        },
    );
