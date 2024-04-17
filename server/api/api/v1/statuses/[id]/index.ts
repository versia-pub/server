import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { config } from "config-manager";
import ISO6391 from "iso-639-1";
import { z } from "zod";
import { db } from "~drizzle/db";
import { Note } from "~packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["GET", "DELETE", "PUT"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id",
    auth: {
        required: false,
        requiredOnMethods: ["DELETE", "PUT"],
    },
});

export const schema = z.object({
    status: z.string().max(config.validation.max_note_size).optional(),
    // TODO: Add regex to validate
    content_type: z.string().optional().default("text/plain"),
    media_ids: z
        .array(z.string().regex(idValidator))
        .max(config.validation.max_media_attachments)
        .optional(),
    spoiler_text: z.string().max(255).optional(),
    sensitive: z.boolean().optional(),
    language: z.enum(ISO6391.getAllCodes() as [string, ...string[]]).optional(),
    "poll[options]": z
        .array(z.string().max(config.validation.max_poll_option_size))
        .max(config.validation.max_poll_options)
        .optional(),
    "poll[expires_in]": z
        .number()
        .int()
        .min(config.validation.min_poll_duration)
        .max(config.validation.max_poll_duration)
        .optional(),
    "poll[multiple]": z.boolean().optional(),
    "poll[hide_totals]": z.boolean().optional(),
});

/**
 * Fetch a user
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const id = matchedRoute.params.id;
        if (!id.match(idValidator)) {
            return errorResponse("Invalid ID, must be of type UUIDv7", 404);
        }

        const { user } = extraData.auth;

        const foundStatus = await Note.fromId(id);

        const config = await extraData.configManager.getConfig();

        // Check if user is authorized to view this status (if it's private)
        if (!foundStatus?.isViewableByUser(user))
            return errorResponse("Record not found", 404);

        if (req.method === "GET") {
            return jsonResponse(await foundStatus.toAPI(user));
        }
        if (req.method === "DELETE") {
            if (foundStatus.getAuthor().id !== user?.id) {
                return errorResponse("Unauthorized", 401);
            }

            // TODO: Implement delete and redraft functionality

            // Delete status and all associated objects
            await foundStatus.delete();

            return jsonResponse(await foundStatus.toAPI(user), 200);
        }
        if (req.method === "PUT") {
            if (foundStatus.getAuthor().id !== user?.id) {
                return errorResponse("Unauthorized", 401);
            }

            const {
                status: statusText,
                content_type,
                "poll[options]": options,
                media_ids,
                spoiler_text,
                sensitive,
            } = extraData.parsedRequest;

            // TODO: Add Poll support
            // Validate status
            if (!statusText && !(media_ids && media_ids.length > 0)) {
                return errorResponse(
                    "Status is required unless media is attached",
                    422,
                );
            }

            if (media_ids && media_ids.length > 0 && options) {
                // Disallow poll
                return errorResponse(
                    "Cannot attach poll to post with media",
                    422,
                );
            }

            // Check if status body doesnt match filters
            if (
                config.filters.note_content.some((filter) =>
                    statusText?.match(filter),
                )
            ) {
                return errorResponse("Status contains blocked words", 422);
            }

            // Check if media attachments are all valid
            if (media_ids && media_ids.length > 0) {
                const foundAttachments = await db.query.attachment.findMany({
                    where: (attachment, { inArray }) =>
                        inArray(attachment.id, media_ids),
                });

                if (foundAttachments.length !== (media_ids ?? []).length) {
                    return errorResponse("Invalid media IDs", 422);
                }
            }

            const newNote = await foundStatus.updateFromData(
                statusText
                    ? {
                          [content_type]: {
                              content: statusText,
                          },
                      }
                    : undefined,
                undefined,
                sensitive,
                spoiler_text,
                undefined,
                undefined,
                media_ids,
            );

            if (!newNote) {
                return errorResponse("Failed to update status", 500);
            }

            return jsonResponse(await newNote.toAPI(user));
        }

        return jsonResponse({});
    },
);
