import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import type { Relationship } from "~database/entities/Relationship";
import { db } from "~drizzle/db";
import { Note } from "~packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 8,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/context",
    auth: {
        required: false,
    },
});

/**
 * Fetch a user
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    // Public for public statuses limited to 40 ancestors and 60 descendants with a maximum depth of 20.
    // User token + read:statuses for up to 4,096 ancestors, 4,096 descendants, unlimited depth, and private statuses.
    const id = matchedRoute.params.id;
    if (!id.match(idValidator)) {
        return errorResponse("Invalid ID, must be of type UUIDv7", 404);
    }

    const { user } = extraData.auth;

    const foundStatus = await Note.fromId(id);

    if (!foundStatus) return errorResponse("Record not found", 404);

    const relations = user
        ? await db.query.relationship.findMany({
              where: (relationship, { eq }) =>
                  eq(relationship.ownerId, user.id),
          })
        : null;

    const relationSubjects = user
        ? await db.query.relationship.findMany({
              where: (relationship, { eq }) =>
                  eq(relationship.subjectId, user.id),
          })
        : null;

    // Get all ancestors
    const ancestors = await foundStatus.getAncestors(
        user
            ? {
                  ...user,
                  relationships: relations as Relationship[],
                  relationshipSubjects: relationSubjects as Relationship[],
              }
            : null,
    );

    const descendants = await foundStatus.getDescendants(
        user
            ? {
                  ...user,
                  relationships: relations as Relationship[],
                  relationshipSubjects: relationSubjects as Relationship[],
              }
            : null,
    );

    return jsonResponse({
        ancestors: await Promise.all(
            ancestors.map((status) => status.toAPI(user)),
        ),
        descendants: await Promise.all(
            descendants.map((status) => status.toAPI(user)),
        ),
    });
});
