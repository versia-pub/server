import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { findManyUsers, userToAPI } from "~database/entities/User";
import { db } from "~drizzle/db";

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

/**
 * Find familiar followers (followers of a user that you also follow)
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

    const idFollowerRelationships = await db.query.relationship.findMany({
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
    const relevantRelationships = await db.query.relationship.findMany({
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
    });

    if (relevantRelationships.length === 0) {
        return jsonResponse([]);
    }

    const finalUsers = await findManyUsers({
        where: (user, { inArray }) =>
            inArray(
                user.id,
                relevantRelationships.map((r) => r.subjectId),
            ),
    });

    if (finalUsers.length === 0) {
        return jsonResponse([]);
    }

    return jsonResponse(finalUsers.map((o) => userToAPI(o)));
});
