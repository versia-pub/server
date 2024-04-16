import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { sql } from "drizzle-orm";
import { likeToLysand, type Like } from "~database/entities/Like";
import {
    findFirstStatuses,
    statusToLysand,
    type StatusWithRelations,
} from "~database/entities/Status";
import { db } from "~drizzle/db";
import type * as Lysand from "lysand-types";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/objects/:id",
});

export default apiRoute(async (req, matchedRoute) => {
    const uuid = matchedRoute.params.uuid;

    let foundObject: StatusWithRelations | Like | null = null;
    let apiObject: Lysand.Entity | null = null;

    foundObject =
        (await findFirstStatuses({
            where: (status, { eq, and, inArray }) =>
                and(
                    eq(status.id, uuid),
                    inArray(status.visibility, ["public", "unlisted"]),
                ),
        })) ?? null;
    apiObject = foundObject ? statusToLysand(foundObject) : null;

    if (!foundObject) {
        foundObject =
            (await db.query.like.findFirst({
                where: (like, { eq, and }) =>
                    and(
                        eq(like.id, uuid),
                        sql`EXISTS (SELECT 1 FROM statuses WHERE statuses.id = ${like.likedId} AND statuses.visibility IN ('public', 'unlisted'))`,
                    ),
            })) ?? null;
        apiObject = foundObject ? likeToLysand(foundObject) : null;
    }

    if (!foundObject) {
        return errorResponse("Object not found", 404);
    }

    return jsonResponse(foundObject);
});
