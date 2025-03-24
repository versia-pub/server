import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Attachment as AttachmentSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Media } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

const routePut = createRoute({
    method: "put",
    path: "/api/v1/media/{id}",
    summary: "Update media attachment",
    description:
        "Update a MediaAttachment’s parameters, before it is attached to a status and posted.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/media/#update",
    },
    tags: ["Media"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:media"],
            permissions: [RolePermission.ManageOwnMedia],
        }),
    ] as const,
    request: {
        params: z.object({
            id: AttachmentSchema.shape.id,
        }),
        body: {
            content: {
                "multipart/form-data": {
                    schema: z
                        .object({
                            thumbnail: z.instanceof(File).openapi({
                                description:
                                    "The custom thumbnail of the media to be attached, encoded using multipart form data.",
                            }),
                            description: AttachmentSchema.shape.description,
                            focus: z.string().openapi({
                                description:
                                    "Two floating points (x,y), comma-delimited, ranging from -1.0 to 1.0. Used for media cropping on clients.",
                                externalDocs: {
                                    url: "https://docs.joinmastodon.org/api/guidelines/#focal-points",
                                },
                            }),
                        })
                        .partial(),
                },
            },
        },
    },
    responses: {
        200: {
            description: "Updated attachment",
            content: {
                "application/json": {
                    schema: AttachmentSchema,
                },
            },
        },
        404: {
            description: "Attachment not found",
            content: {
                "application/json": {
                    schema: ApiError.zodSchema,
                },
            },
        },
        401: ApiError.missingAuthentication().schema,
        422: ApiError.validationFailed().schema,
    },
});

const routeGet = createRoute({
    method: "get",
    path: "/api/v1/media/{id}",
    summary: "Get media attachment",
    description:
        "Get a media attachment, before it is attached to a status and posted, but after it is accepted for processing. Use this method to check that the full-sized media has finished processing.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/media/#get",
    },
    tags: ["Media"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnMedia],
        }),
    ] as const,
    request: {
        params: z.object({
            id: AttachmentSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description: "Attachment",
            content: {
                "application/json": {
                    schema: AttachmentSchema,
                },
            },
        },
        404: {
            description: "Attachment not found",
            content: {
                "application/json": {
                    schema: ApiError.zodSchema,
                },
            },
        },
        401: ApiError.missingAuthentication().schema,
        422: ApiError.validationFailed().schema,
    },
});

export default apiRoute((app) => {
    app.openapi(routePut, async (context) => {
        const { id } = context.req.valid("param");

        const media = await Media.fromId(id);

        if (!media) {
            throw ApiError.mediaNotFound();
        }

        const { description, thumbnail: thumbnailFile } =
            context.req.valid("form");

        if (thumbnailFile) {
            await media.updateThumbnail(thumbnailFile);
        }

        if (description) {
            await media.updateMetadata({
                description,
            });
        }

        return context.json(media.toApi(), 200);
    });

    app.openapi(routeGet, async (context) => {
        const { id } = context.req.valid("param");

        const attachment = await Media.fromId(id);

        if (!attachment) {
            throw ApiError.mediaNotFound();
        }

        return context.json(attachment.toApi(), 200);
    });
});
