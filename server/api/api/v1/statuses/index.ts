import { apiRoute, applyConfig, auth, handleZodError, jsonOrForm } from "@/api";
import { zValidator } from "@hono/zod-validator";
import ISO6391 from "iso-639-1";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { config } from "~/packages/config-manager/index";
import { Attachment } from "~/packages/database-interface/attachment";
import { Note } from "~/packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 300,
        duration: 60,
    },
    route: "/api/v1/statuses",
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnNotes],
    },
});

export const schemas = {
    json: z
        .object({
            status: z
                .string()
                .max(config.validation.max_note_size)
                .trim()
                .refine(
                    (s) =>
                        !config.filters.note_content.some((filter) =>
                            s.match(filter),
                        ),
                    "Status contains blocked words",
                )
                .optional(),
            // TODO: Add regex to validate
            content_type: z.string().optional().default("text/plain"),
            media_ids: z
                .array(z.string().uuid())
                .max(config.validation.max_media_attachments)
                .default([]),
            spoiler_text: z.string().max(255).trim().optional(),
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
            in_reply_to_id: z.string().uuid().optional().nullable(),
            quote_id: z.string().uuid().optional().nullable(),
            visibility: z
                .enum(["public", "unlisted", "private", "direct"])
                .optional()
                .default("public"),
            scheduled_at: z.coerce
                .date()
                .min(new Date(), "Scheduled time must be in the future")
                .optional()
                .nullable(),
            local_only: z
                .string()
                .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
                .or(z.boolean())
                .optional()
                .default(false),
        })
        .refine(
            (obj) => obj.status || obj.media_ids.length > 0,
            "Status is required unless media is attached",
        )
        .refine(
            (obj) => !(obj.media_ids.length > 0 && obj["poll[options]"]),
            "Cannot attach poll to media",
        ),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        jsonOrForm(),
        zValidator("json", schemas.json, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user, application } = context.req.valid("header");

            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            const {
                status,
                media_ids,
                in_reply_to_id,
                quote_id,
                sensitive,
                spoiler_text,
                visibility,
                content_type,
                local_only,
            } = context.req.valid("json");

            // Check if media attachments are all valid
            if (media_ids.length > 0) {
                const foundAttachments = await Attachment.fromIds(media_ids);

                if (foundAttachments.length !== media_ids.length) {
                    return context.json({ error: "Invalid media IDs" }, 422);
                }
            }

            // Check that in_reply_to_id and quote_id are real posts if provided
            if (in_reply_to_id && !(await Note.fromId(in_reply_to_id))) {
                return context.json(
                    { error: "Invalid in_reply_to_id (not found)" },
                    422,
                );
            }

            if (quote_id && !(await Note.fromId(quote_id))) {
                return context.json(
                    { error: "Invalid quote_id (not found)" },
                    422,
                );
            }

            const newNote = await Note.fromData({
                author: user,
                content: {
                    [content_type]: {
                        content: status ?? "",
                    },
                },
                visibility,
                isSensitive: sensitive ?? false,
                spoilerText: spoiler_text ?? "",
                mediaAttachments: media_ids,
                replyId: in_reply_to_id ?? undefined,
                quoteId: quote_id ?? undefined,
                application: application ?? undefined,
            });

            if (!local_only) {
                await newNote.federateToUsers();
            }

            return context.json(await newNote.toApi(user));
        },
    ),
);
