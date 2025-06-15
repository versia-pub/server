import {
    Attachment as AttachmentSchema,
    PollOption,
    RolePermission,
    Status as StatusSchema,
    StatusSource as StatusSourceSchema,
    zBoolean,
} from "@versia/client/schemas";
import * as VersiaEntities from "@versia/sdk/entities";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import {
    apiRoute,
    auth,
    handleZodError,
    jsonOrForm,
} from "@versia-server/kit/api";
import { Emoji, Media, Note } from "@versia-server/kit/db";
import {
    parseMentionsFromText,
    versiaTextToHtml,
} from "@versia-server/kit/parsers";
import { randomUUIDv7 } from "bun";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { sanitizedHtmlStrip } from "@/sanitization";

const schema = z
    .object({
        status: StatusSourceSchema.shape.text
            .max(config.validation.notes.max_characters)
            .refine(
                (s) =>
                    !config.validation.filters.note_content.some((filter) =>
                        filter.test(s),
                    ),
                "Status contains blocked words",
            )
            .optional()
            .openapi({
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
            .max(config.validation.notes.max_attachments)
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
            .array(
                PollOption.shape.title.max(
                    config.validation.polls.max_option_characters,
                ),
            )
            .max(config.validation.polls.max_options)
            .optional()
            .openapi({
                description:
                    "Possible answers to the poll. If provided, media_ids cannot be used, and poll[expires_in] must be provided.",
            }),
        "poll[expires_in]": z.coerce
            .number()
            .int()
            .min(config.validation.polls.min_duration_seconds)
            .max(config.validation.polls.max_duration_seconds)
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

export default apiRoute((app) =>
    app.post(
        "/api/v1/statuses",
        describeRoute({
            summary: "Post a new status",
            description: "Publish a status with the given parameters.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#create",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description:
                        "Status will be posted with chosen parameters.",
                    content: {
                        "application/json": {
                            schema: resolver(StatusSchema),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnNotes],
        }),
        jsonOrForm(),
        validator("json", schema, handleZodError),
        async (context) => {
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

            const reply = in_reply_to_id
                ? await Note.fromId(in_reply_to_id)
                : null;

            // Check that in_reply_to_id and quote_id are real posts if provided
            if (in_reply_to_id && !reply) {
                throw new ApiError(
                    422,
                    "Note referenced by in_reply_to_id not found",
                );
            }

            if (in_reply_to_id && reply?.data.reblogId) {
                throw new ApiError(422, "Cannot reply to a reblog");
            }

            const quote = quote_id ? await Note.fromId(quote_id) : null;

            if (quote_id && !quote) {
                throw new ApiError(
                    422,
                    "Note referenced by quote_id not found",
                );
            }

            if (quote_id && quote?.data.reblogId) {
                throw new ApiError(422, "Cannot quote a reblog");
            }

            const sanitizedSpoilerText = spoiler_text
                ? await sanitizedHtmlStrip(spoiler_text)
                : undefined;

            const content = status
                ? new VersiaEntities.TextContentFormat({
                      [content_type]: {
                          content: status,
                          remote: false,
                      },
                  })
                : undefined;

            const parsedMentions = status
                ? await parseMentionsFromText(status)
                : [];

            const parsedEmojis = status
                ? await Emoji.parseFromText(status)
                : [];

            const newNote = await Note.insert({
                id: randomUUIDv7(),
                authorId: user.id,
                visibility,
                content: content
                    ? await versiaTextToHtml(content, parsedMentions)
                    : undefined,
                sensitive,
                spoilerText: sanitizedSpoilerText,
                replyId: in_reply_to_id ?? undefined,
                quotingId: quote_id ?? undefined,
                applicationId: application?.id,
                contentSource: status,
                contentType: content_type,
            });

            // Emojis, mentions, and attachments are stored in a different table, so update them there too
            await newNote.updateEmojis(parsedEmojis);
            await newNote.updateMentions(parsedMentions);
            await newNote.updateAttachments(foundAttachments);

            await newNote.reload();

            if (!local_only) {
                await newNote.federateToUsers();
            }

            // Send notifications for mentioned local users
            for (const mentioned of parsedMentions) {
                if (mentioned.local) {
                    await mentioned.notify("mention", user, newNote);
                }
            }

            return context.json(await newNote.toApi(user), 200);
        },
    ),
);
