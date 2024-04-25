import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { z } from "zod";
import {
    createNewRelationship,
    relationshipToAPI,
} from "~database/entities/Relationship";
import type { UserType } from "~database/entities/User";
import { db } from "~drizzle/db";

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
});

export const schema = z.object({
    id: z.array(z.string().regex(idValidator)).min(1).max(10),
});

/**
 * Find relationships
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { user: self } = extraData.auth;

        if (!self) return errorResponse("Unauthorized", 401);

        const { id: ids } = extraData.parsedRequest;

        const relationships = await db.query.Relationships.findMany({
            where: (relationship, { inArray, and, eq }) =>
                and(
                    inArray(relationship.subjectId, ids),
                    eq(relationship.ownerId, self.id),
                ),
        });

        // Find IDs that dont have a relationship
        const missingIds = ids.filter(
            (id) => !relationships.some((r) => r.subjectId === id),
        );

        // Create the missing relationships
        for (const id of missingIds) {
            const relationship = await createNewRelationship(self, {
                id,
            } as UserType);

            relationships.push(relationship);
        }

        // Order in the same order as ids
        relationships.sort(
            (a, b) => ids.indexOf(a.subjectId) - ids.indexOf(b.subjectId),
        );

        return jsonResponse(relationships.map((r) => relationshipToAPI(r)));
    },
);
