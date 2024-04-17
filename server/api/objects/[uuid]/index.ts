import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, eq, inArray, sql } from "drizzle-orm";
import type * as Lysand from "lysand-types";
import { type Like, likeToLysand } from "~database/entities/Like";
import { db } from "~drizzle/db";
import { Notes } from "~drizzle/schema";
import { Note } from "~packages/database-interface/note";

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

    let foundObject: Note | Like | null = null;
    let apiObject: Lysand.Entity | null = null;

    foundObject = await Note.fromSql(
        and(
            eq(Notes.id, uuid),
            inArray(Notes.visibility, ["public", "unlisted"]),
        ),
    );
    apiObject = foundObject ? foundObject.toLysand() : null;

    if (!foundObject) {
        foundObject =
            (await db.query.Likes.findFirst({
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
