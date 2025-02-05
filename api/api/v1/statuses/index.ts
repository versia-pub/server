import { apiRoute, auth, jsonOrForm } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Media, Note } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import ISO6391 from "iso-639-1";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/packages/config-manager/index.ts";
import { ErrorSchema } from "~/types/api";

const schemas = {
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

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnNotes],
        }),
        jsonOrForm(),
    ] as const,
    summary: "Post a new status",
    request: {
        body: {
            content: {
                "application/json": {
                    schema: schemas.json,
                },
                "application/x-www-form-urlencoded": {
                    schema: schemas.json,
                },
                "multipart/form-data": {
                    schema: schemas.json,
                },
            },
        },
    },
    responses: {
        201: {
            description: "The new status",
            content: {
                "application/json": {
                    schema: Note.schema,
                },
            },
        },

        422: {
            description: "Invalid data",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user, application } = context.get("auth");

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
        const foundAttachments =
            media_ids.length > 0 ? await Media.fromIds(media_ids) : [];

        if (foundAttachments.length !== media_ids.length) {
            throw new ApiError(
                422,
                "Some attachments referenced by media_ids not found",
            );
        }

        // Check that in_reply_to_id and quote_id are real posts if provided
        if (in_reply_to_id && !(await Note.fromId(in_reply_to_id))) {
            throw new ApiError(
                422,
                "Note referenced by in_reply_to_id not found",
            );
        }

        if (quote_id && !(await Note.fromId(quote_id))) {
            throw new ApiError(422, "Note referenced by quote_id not found");
        }

        const newNote = await Note.fromData({
            author: user,
            content: {
                [content_type]: {
                    content: status ?? "",
                    remote: false,
                },
            },
            visibility,
            isSensitive: sensitive ?? false,
            spoilerText: spoiler_text ?? "",
            mediaAttachments: foundAttachments,
            replyId: in_reply_to_id ?? undefined,
            quoteId: quote_id ?? undefined,
            application: application ?? undefined,
        });

        if (!local_only) {
            await newNote.federateToUsers();
        }

        return context.json(await newNote.toApi(user), 201);
    }),
);
