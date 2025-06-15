import {
    Attachment as AttachmentSchema,
    PollOption,
    RolePermission,
    Status as StatusSchema,
    StatusSource as StatusSourceSchema,
    zBoolean,
} from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { Emoji, Media } from "@versia/kit/db";
import * as VersiaEntities from "@versia/sdk/entities";
import { config } from "@versia-server/config";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import {
    apiRoute,
    auth,
    handleZodError,
    jsonOrForm,
    withNoteParam,
} from "@/api";
import { sanitizedHtmlStrip } from "@/sanitization";
import { contentToHtml, parseTextMentions } from "~/classes/functions/status";

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
    })
    .refine(
        (obj) => !(obj.media_ids.length > 0 && obj["poll[options]"]),
        "Cannot attach poll to media",
    );

export default apiRoute((app) => {
    app.get(
        "/api/v1/statuses/:id",
        describeRoute({
            summary: "View a single status",
            description: "Obtain information about a status.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#get",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description: "Status",
                    content: {
                        "application/json": {
                            schema: resolver(StatusSchema),
                        },
                    },
                },
                404: ApiError.noteNotFound().schema,
            },
        }),
        auth({
            auth: false,
            permissions: [RolePermission.ViewNotes],
        }),
        withNoteParam,
        async (context) => {
            const { user } = context.get("auth");
            const note = context.get("note");

            return context.json(await note.toApi(user), 200);
        },
    );

    app.delete(
        "/api/v1/statuses/:id",
        describeRoute({
            summary: "Delete a status",
            description: "Delete one of your own statuses.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#delete",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description:
                        "Note the special properties text and poll or media_attachments which may be used to repost the status, e.g. in case of delete-and-redraft functionality.",
                    content: {
                        "application/json": {
                            schema: resolver(StatusSchema),
                        },
                    },
                },
                404: ApiError.noteNotFound().schema,
                401: ApiError.missingAuthentication().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [
                RolePermission.ManageOwnNotes,
                RolePermission.ViewNotes,
            ],
        }),
        withNoteParam,
        async (context) => {
            const { user } = context.get("auth");
            const note = context.get("note");

            if (note.author.id !== user.id) {
                throw ApiError.forbidden();
            }

            // TODO: Delete and redraft
            await note.delete();

            await user.federateToFollowers(note.deleteToVersia());

            return context.json(await note.toApi(user), 200);
        },
    );

    app.put(
        "/api/v1/statuses/:id",
        describeRoute({
            summary: "Edit a status",
            description:
                "Edit a given status to change its text, sensitivity, media attachments, or poll. Note that editing a poll’s options will reset the votes.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#edit",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description: "Status has been successfully edited.",
                    content: {
                        "application/json": {
                            schema: resolver(StatusSchema),
                        },
                    },
                },
                404: ApiError.noteNotFound().schema,
                403: ApiError.forbidden().schema,
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [
                RolePermission.ManageOwnNotes,
                RolePermission.ViewNotes,
            ],
        }),
        jsonOrForm(),
        withNoteParam,
        validator("json", schema, handleZodError),
        async (context) => {
            const { user } = context.get("auth");
            const note = context.get("note");

            if (note.author.id !== user.id) {
                throw ApiError.forbidden();
            }

            // TODO: Polls
            const {
                status: statusText,
                content_type,
                media_ids,
                spoiler_text,
                sensitive,
            } = context.req.valid("json");

            const foundAttachments =
                media_ids.length > 0 ? await Media.fromIds(media_ids) : [];

            if (foundAttachments.length !== media_ids.length) {
                throw new ApiError(
                    422,
                    "Some attachments referenced by media_ids not found",
                );
            }

            const sanitizedSpoilerText = spoiler_text
                ? await sanitizedHtmlStrip(spoiler_text)
                : undefined;

            const content = statusText
                ? new VersiaEntities.TextContentFormat({
                      [content_type]: {
                          content: statusText,
                          remote: false,
                      },
                  })
                : undefined;

            const parsedMentions = statusText
                ? await parseTextMentions(statusText)
                : [];

            const parsedEmojis = statusText
                ? await Emoji.parseFromText(statusText)
                : [];

            await note.update({
                spoilerText: sanitizedSpoilerText,
                sensitive,
                content: content
                    ? await contentToHtml(content, parsedMentions)
                    : undefined,
            });

            // Emojis, mentions, and attachments are stored in a different table, so update them there too
            await note.updateEmojis(parsedEmojis);
            await note.updateMentions(parsedMentions);
            await note.updateAttachments(foundAttachments);

            await note.reload();

            // Send notifications for mentioned local users
            for (const mentioned of parsedMentions) {
                if (mentioned.local) {
                    await mentioned.notify("mention", user, note);
                }
            }

            return context.json(await note.toApi(user), 200);
        },
    );
});
