import {
    apiRoute,
    auth,
    jsonOrForm,
    noteNotFound,
    reusedResponses,
    withNoteParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Media } from "@versia/kit/db";
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
    })
    .refine(
        (obj) => !(obj.media_ids.length > 0 && obj["poll[options]"]),
        "Cannot attach poll to media",
    );

const routeGet = createRoute({
    method: "get",
    path: "/api/v1/statuses/{id}",
    summary: "View a single status",
    description: "Obtain information about a status.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/statuses/#get",
    },
    tags: ["Statuses"],
    middleware: [
        auth({
            auth: false,
            permissions: [RolePermissions.ViewNotes],
        }),
        withNoteParam,
    ] as const,
    request: {
        params: z.object({
            id: StatusSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description: "Status",
            content: {
                "application/json": {
                    schema: StatusSchema,
                },
            },
        },
        404: noteNotFound,
    },
});

const routeDelete = createRoute({
    method: "delete",
    path: "/api/v1/statuses/{id}",
    summary: "Delete a status",
    description: "Delete one of your own statuses.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/statuses/#delete",
    },
    tags: ["Statuses"],
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnNotes,
                RolePermissions.ViewNotes,
            ],
        }),
        withNoteParam,
    ] as const,
    request: {
        params: z.object({
            id: StatusSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description:
                "Note the special properties text and poll or media_attachments which may be used to repost the status, e.g. in case of delete-and-redraft functionality.",
            content: {
                "application/json": {
                    schema: StatusSchema,
                },
            },
        },
        404: noteNotFound,
        401: reusedResponses[401],
    },
});

const routePut = createRoute({
    method: "put",
    path: "/api/v1/statuses/{id}",
    summary: "Edit a status",
    description:
        "Edit a given status to change its text, sensitivity, media attachments, or poll. Note that editing a poll’s options will reset the votes.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/statuses/#edit",
    },
    tags: ["Statuses"],
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnNotes,
                RolePermissions.ViewNotes,
            ],
        }),
        jsonOrForm(),
        withNoteParam,
    ] as const,
    request: {
        params: z.object({
            id: StatusSchema.shape.id,
        }),
        body: {
            content: {
                "application/json": {
                    schema,
                },
                "application/x-www-form-urlencoded": {
                    schema,
                },
                "multipart/form-data": {
                    schema,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Status has been successfully edited.",
            content: {
                "application/json": {
                    schema: StatusSchema,
                },
            },
        },
        404: noteNotFound,
        ...reusedResponses,
    },
});

export default apiRoute((app) => {
    app.openapi(routeGet, async (context) => {
        const { user } = context.get("auth");
        const note = context.get("note");

        return context.json(await note.toApi(user), 200);
    });

    app.openapi(routeDelete, async (context) => {
        const { user } = context.get("auth");
        const note = context.get("note");

        if (note.author.id !== user.id) {
            throw new ApiError(401, "Unauthorized");
        }

        // TODO: Delete and redraft
        await note.delete();

        await user.federateToFollowers(note.deleteToVersia());

        return context.json(await note.toApi(user), 200);
    });

    app.openapi(routePut, async (context) => {
        const { user } = context.get("auth");
        const note = context.get("note");

        if (note.author.id !== user.id) {
            throw new ApiError(401, "Unauthorized");
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

        const newNote = await note.updateFromData({
            author: user,
            content: statusText
                ? {
                      [content_type]: {
                          content: statusText,
                          remote: false,
                      },
                  }
                : undefined,
            isSensitive: sensitive,
            spoilerText: spoiler_text,
            mediaAttachments: foundAttachments,
        });

        return context.json(await newNote.toApi(user), 200);
    });
});
