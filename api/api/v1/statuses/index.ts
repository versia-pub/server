import { apiRoute, auth, jsonOrForm, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Media, Note } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { ApiError } from "~/classes/errors/api-error";
import { Attachment as AttachmentSchema } from "~/classes/schemas/attachment";
import { PollOption } from "~/classes/schemas/poll";
import {
    Status as StatusSchema,
    StatusSource as StatusSourceSchema,
} from "~/classes/schemas/status";
import { zBoolean } from "~/packages/config-manager/config.type";
import { config } from "~/packages/config-manager/index.ts";

const schema = z
    .object({
        status: StatusSourceSchema.shape.text.optional().openapi({
            description:
                "The text content of the status. If media_ids is provided, this becomes optional. Attaching a poll is optional while status is provided.",
        }),
        /* Versia Server API Extension */
        content_type: z
            .enum(["text/plain", "text/html", "text/markdown"])
            .default("text/plain")
            .openapi({
                description: "Content-Type of the status text.",
                example: "text/markdown",
            }),
        media_ids: z
            .array(AttachmentSchema.shape.id)
            .max(config.validation.max_media_attachments)
            .default([])
            .openapi({
                description:
                    "Include Attachment IDs to be attached as media. If provided, status becomes optional, and poll cannot be used.",
            }),
        spoiler_text: StatusSourceSchema.shape.spoiler_text.optional().openapi({
            description:
                "Text to be shown as a warning or subject before the actual content. Statuses are generally collapsed behind this field.",
        }),
        sensitive: zBoolean.default(false).openapi({
            description: "Mark status and attached media as sensitive?",
        }),
        language: StatusSchema.shape.language.optional(),
        "poll[options]": z
            .array(PollOption.shape.title)
            .max(config.validation.max_poll_options)
            .optional()
            .openapi({
                description:
                    "Possible answers to the poll. If provided, media_ids cannot be used, and poll[expires_in] must be provided.",
            }),
        "poll[expires_in]": z.coerce
            .number()
            .int()
            .min(config.validation.min_poll_duration)
            .max(config.validation.max_poll_duration)
            .optional()
            .openapi({
                description:
                    "Duration that the poll should be open, in seconds. If provided, media_ids cannot be used, and poll[options] must be provided.",
            }),
        "poll[multiple]": zBoolean.optional().openapi({
            description: "Allow multiple choices?",
        }),
        "poll[hide_totals]": zBoolean.optional().openapi({
            description: "Hide vote counts until the poll ends?",
        }),
        in_reply_to_id: StatusSchema.shape.id.optional().nullable().openapi({
            description:
                "ID of the status being replied to, if status is a reply.",
        }),
        /* Versia Server API Extension */
        quote_id: StatusSchema.shape.id.optional().nullable().openapi({
            description: "ID of the status being quoted, if status is a quote.",
        }),
        visibility: StatusSchema.shape.visibility.default("public"),
        scheduled_at: z.coerce
            .date()
            .min(
                new Date(Date.now() + 5 * 60 * 1000),
                "must be at least 5 minutes in the future.",
            )
            .optional()
            .nullable()
            .openapi({
                description:
                    "Datetime at which to schedule a status. Providing this parameter will cause ScheduledStatus to be returned instead of Status. Must be at least 5 minutes in the future.",
            }),
        /* Versia Server API Extension */
        local_only: zBoolean.default(false).openapi({
            description: "If true, this status will not be federated.",
        }),
    })
    .refine(
        (obj) => obj.status || obj.media_ids.length > 0 || obj["poll[options]"],
        "Status is required unless media or poll is attached",
    )
    .refine(
        (obj) => !(obj.media_ids.length > 0 && obj["poll[options]"]),
        "Cannot attach poll to media",
    );

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses",
    summary: "Post a new status",
    description: "Publish a status with the given parameters.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/statuses/#create",
    },
    tags: ["Statuses"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnNotes],
        }),
        jsonOrForm(),
    ] as const,
    request: {
        body: {
            content: {
                "application/json": {
                    schema: schema,
                },
                "application/x-www-form-urlencoded": {
                    schema: schema,
                },
                "multipart/form-data": {
                    schema: schema,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Status will be posted with chosen parameters.",
            content: {
                "application/json": {
                    schema: StatusSchema,
                },
            },
        },
        ...reusedResponses,
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

        return context.json(await newNote.toApi(user), 200);
    }),
);
