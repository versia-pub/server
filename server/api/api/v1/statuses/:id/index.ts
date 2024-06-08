import {
    applyConfig,
    auth,
    handleZodError,
    idValidator,
    jsonOrForm,
} from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { config } from "config-manager";
import type { Hono } from "hono";
import ISO6391 from "iso-639-1";
import { z } from "zod";
import { undoFederationRequest } from "~/database/entities/Federation";
import { db } from "~/drizzle/db";
import { RolePermissions } from "~/drizzle/schema";
import { Note } from "~/packages/database-interface/note";

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
    permissions: {
        required: [RolePermissions.VIEW_NOTES],
        methodOverrides: {
            DELETE: [
                RolePermissions.MANAGE_OWN_NOTES,
                RolePermissions.VIEW_NOTES,
            ],
            PUT: [RolePermissions.MANAGE_OWN_NOTES, RolePermissions.VIEW_NOTES],
        },
    },
});

export const schemas = {
    param: z.object({
        id: z.string().regex(idValidator),
    }),
    form: z.object({
        status: z.string().max(config.validation.max_note_size).optional(),
        content_type: z.string().optional().default("text/plain"),
        media_ids: z
            .array(z.string().regex(idValidator))
            .max(config.validation.max_media_attachments)
            .optional(),
        spoiler_text: z.string().max(255).optional(),
        sensitive: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .or(z.boolean())
            .optional(),
        language: z
            .enum(ISO6391.getAllCodes() as [string, ...string[]])
            .optional(),
        "poll[options]": z
            .array(z.string().max(config.validation.max_poll_option_size))
            .max(config.validation.max_poll_options)
            .optional(),
        "poll[expires_in]": z.coerce
            .number()
            .int()
            .min(config.validation.min_poll_duration)
            .max(config.validation.max_poll_duration)
            .optional(),
        "poll[multiple]": z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .or(z.boolean())
            .optional(),
        "poll[hide_totals]": z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .or(z.boolean())
            .optional(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        jsonOrForm(),
        zValidator("param", schemas.param, handleZodError),
        zValidator("form", schemas.form, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");
            const { user } = context.req.valid("header");

            const foundStatus = await Note.fromId(id, user?.id);

            if (!foundStatus?.isViewableByUser(user))
                return errorResponse("Record not found", 404);

            if (context.req.method === "GET") {
                return jsonResponse(await foundStatus.toAPI(user));
            }
            if (context.req.method === "DELETE") {
                if (foundStatus.getAuthor().id !== user?.id) {
                    return errorResponse("Unauthorized", 401);
                }

                // TODO: Delete and redraft

                await foundStatus.delete();

                await user.federateToFollowers(
                    undoFederationRequest(user, foundStatus.getURI()),
                );

                return jsonResponse(await foundStatus.toAPI(user), 200);
            }

            // TODO: Polls
            const {
                status: statusText,
                content_type,
                "poll[options]": options,
                media_ids,
                spoiler_text,
                sensitive,
            } = context.req.valid("form");

            if (!statusText && !(media_ids && media_ids.length > 0)) {
                return errorResponse(
                    "Status is required unless media is attached",
                    422,
                );
            }

            if (media_ids && media_ids.length > 0 && options) {
                return errorResponse(
                    "Cannot attach poll to post with media",
                    422,
                );
            }

            if (
                config.filters.note_content.some((filter) =>
                    statusText?.match(filter),
                )
            ) {
                return errorResponse("Status contains blocked words", 422);
            }

            if (media_ids && media_ids.length > 0) {
                const foundAttachments = await db.query.Attachments.findMany({
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
        },
    );
