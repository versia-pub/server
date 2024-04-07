import { apiRoute, applyConfig } from "@api";
import type { User } from "@prisma/client";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import {
    createNewRelationship,
    relationshipToAPI,
} from "~database/entities/Relationship";

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

/**
 * Find relationships
 */
export default apiRoute<{
    id: string[];
}>(async (req, matchedRoute, extraData) => {
    const { user: self } = extraData.auth;

    if (!self) return errorResponse("Unauthorized", 401);

    const { id: ids } = extraData.parsedRequest;

    // Minimum id count 1, maximum 10
    if (!ids || ids.length < 1 || ids.length > 10) {
        return errorResponse("Number of ids must be between 1 and 10", 422);
    }

    const relationships = await client.relationship.findMany({
        where: {
            ownerId: self.id,
            subjectId: {
                in: ids,
            },
        },
    });

    // Find IDs that dont have a relationship
    const missingIds = ids.filter(
        (id) => !relationships.some((r) => r.subjectId === id),
    );

    // Create the missing relationships
    for (const id of missingIds) {
        const relationship = await createNewRelationship(self, { id } as User);

        relationships.push(relationship);
    }

    // Order in the same order as ids
    relationships.sort(
        (a, b) => ids.indexOf(a.subjectId) - ids.indexOf(b.subjectId),
    );

    return jsonResponse(relationships.map((r) => relationshipToAPI(r)));
});
