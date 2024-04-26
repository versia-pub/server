import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~drizzle/db";
import { Notes, Notifications } from "~drizzle/schema";
import { Note } from "~packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/reblog",
    auth: {
        required: true,
    },
});

export const schema = z.object({
    visibility: z.enum(["public", "unlisted", "private"]).default("public"),
});

/**
 * Reblogs a post
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const id = matchedRoute.params.id;
        if (!id.match(idValidator)) {
            return errorResponse("Invalid ID, must be of type UUIDv7", 404);
        }

        const { user, application } = extraData.auth;

        if (!user) return errorResponse("Unauthorized", 401);

        const { visibility } = extraData.parsedRequest;

        const foundStatus = await Note.fromId(id);

        // Check if user is authorized to view this status (if it's private)
        if (!foundStatus?.isViewableByUser(user))
            return errorResponse("Record not found", 404);

        const existingReblog = await Note.fromSql(
            and(
                eq(Notes.authorId, user.id),
                eq(Notes.reblogId, foundStatus.getStatus().id),
            ),
        );

        if (existingReblog) {
            return errorResponse("Already reblogged", 422);
        }

        const newReblog = await Note.insert({
            authorId: user.id,
            reblogId: foundStatus.getStatus().id,
            visibility,
            sensitive: false,
            updatedAt: new Date().toISOString(),
            applicationId: application?.id ?? null,
        });

        if (!newReblog) {
            return errorResponse("Failed to reblog", 500);
        }

        const finalNewReblog = await Note.fromId(newReblog.id);

        if (!finalNewReblog) {
            return errorResponse("Failed to reblog", 500);
        }

        // Create notification for reblog if reblogged user is on the same instance
        if (foundStatus.getAuthor().isLocal() && user.isLocal()) {
            await db.insert(Notifications).values({
                accountId: user.id,
                notifiedId: foundStatus.getAuthor().id,
                type: "reblog",
                noteId: newReblog.reblogId,
            });
        }

        return jsonResponse(await finalNewReblog.toAPI(user));
    },
);
