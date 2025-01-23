import { apiRoute, auth, jsonOrForm, withNoteParam } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Media, Note } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import ISO6391 from "iso-639-1";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/packages/config-manager/index.ts";
import { ErrorSchema } from "~/types/api";

const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z
        .object({
            status: z
                .string()
                .max(config.validation.max_note_size)
                .refine(
                    (s) =>
                        !config.filters.note_content.some((filter) =>
                            s.match(filter),
                        ),
                    "Status contains blocked words",
                )
                .optional(),
            content_type: z.string().optional().default("text/plain"),
            media_ids: z
                .array(z.string().uuid())
                .max(config.validation.max_media_attachments)
                .default([]),
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
        })
        .refine(
            (obj) => !(obj.media_ids.length > 0 && obj["poll[options]"]),
            "Cannot attach poll to media",
        ),
};

const routeGet = createRoute({
    method: "get",
    path: "/api/v1/statuses/{id}",
    summary: "Get status",
    middleware: [
        auth({
            auth: false,
            permissions: [RolePermissions.ViewNotes],
        }),
        withNoteParam,
    ] as const,
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Status",
            content: {
                "application/json": {
                    schema: Note.schema,
                },
            },
        },
        404: {
            description: "Record not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

const routeDelete = createRoute({
    method: "delete",
    path: "/api/v1/statuses/{id}",
    summary: "Delete a status",
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
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Deleted status",
            content: {
                "application/json": {
                    schema: Note.schema,
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        404: {
            description: "Record not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

const routePut = createRoute({
    method: "put",
    path: "/api/v1/statuses/{id}",
    summary: "Update a status",
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
        params: schemas.param,
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
        200: {
            description: "Updated status",
            content: {
                "application/json": {
                    schema: Note.schema,
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        422: {
            description: "Invalid media IDs",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
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
