import { apiRoute, applyConfig, idValidator } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { sanitizeHtml } from "@sanitization";
import { config } from "config-manager";
import { eq } from "drizzle-orm";
import ISO6391 from "iso-639-1";
import { parse } from "marked";
import { z } from "zod";
import {
    editStatus,
    findFirstStatuses,
    isViewableByUser,
    statusToAPI,
} from "~database/entities/Status";
import { db } from "~drizzle/db";
import { status } from "~drizzle/schema";

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
    content_type: z.string().optional(),
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

        const foundStatus = await findFirstStatuses({
            where: (status, { eq }) => eq(status.id, id),
        });

        const config = await extraData.configManager.getConfig();

        // Check if user is authorized to view this status (if it's private)
        if (!foundStatus || !isViewableByUser(foundStatus, user))
            return errorResponse("Record not found", 404);

        if (req.method === "GET") {
            return jsonResponse(await statusToAPI(foundStatus));
        }
        if (req.method === "DELETE") {
            if (foundStatus.authorId !== user?.id) {
                return errorResponse("Unauthorized", 401);
            }

            // TODO: Implement delete and redraft functionality

            // Delete status and all associated objects
            await db.delete(status).where(eq(status.id, id));

            return jsonResponse(
                {
                    ...(await statusToAPI(foundStatus, user)),
                    // TODO: Add
                    // text: Add source text
                    // poll: Add source poll
                    // media_attachments
                },
                200,
            );
        }
        if (req.method === "PUT") {
            if (foundStatus.authorId !== user?.id) {
                return errorResponse("Unauthorized", 401);
            }

            const {
                status: statusText,
                content_type,
                "poll[expires_in]": expires_in,
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

            let sanitizedStatus: string;

            if (content_type === "text/markdown") {
                sanitizedStatus = await sanitizeHtml(
                    await parse(statusText ?? ""),
                );
            } else if (content_type === "text/x.misskeymarkdown") {
                // Parse as MFM
                // TODO: Parse as MFM
                sanitizedStatus = await sanitizeHtml(
                    await parse(statusText ?? ""),
                );
            } else {
                sanitizedStatus = await sanitizeHtml(statusText ?? "");
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

            // Update status
            const newStatus = await editStatus(foundStatus, {
                content: sanitizedStatus,
                content_type,
                media_attachments: media_ids,
                spoiler_text: spoiler_text ?? "",
                sensitive: sensitive ?? false,
            });

            if (!newStatus) {
                return errorResponse("Failed to update status", 500);
            }

            return jsonResponse(await statusToAPI(newStatus, user));
        }

        return jsonResponse({});
    },
);
