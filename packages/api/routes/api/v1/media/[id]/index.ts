import {
    Attachment as AttachmentSchema,
    RolePermission,
} from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { Media } from "@versia-server/kit/db";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) => {
    app.get(
        "/api/v1/media/:id",
        describeRoute({
            summary: "Get media attachment",
            description:
                "Get a media attachment, before it is attached to a status and posted, but after it is accepted for processing. Use this method to check that the full-sized media has finished processing.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/media/#get",
            },
            tags: ["Media"],
            responses: {
                200: {
                    description: "Attachment",
                    content: {
                        "application/json": {
                            schema: resolver(AttachmentSchema),
                        },
                    },
                },
                404: {
                    description: "Attachment not found",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnMedia],
        }),
        validator(
            "param",
            z.object({
                id: AttachmentSchema.shape.id,
            }),
            handleZodError,
        ),
        async (context) => {
            const { id } = context.req.valid("param");

            const attachment = await Media.fromId(id);

            if (!attachment) {
                throw ApiError.mediaNotFound();
            }

            return context.json(attachment.toApi(), 200);
        },
    );

    app.put(
        "/api/v1/media/:id",
        describeRoute({
            summary: "Update media attachment",
            description:
                "Update a MediaAttachment’s parameters, before it is attached to a status and posted.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/media/#update",
            },
            tags: ["Media"],
            responses: {
                200: {
                    description: "Updated attachment",
                    content: {
                        "application/json": {
                            schema: resolver(AttachmentSchema),
                        },
                    },
                },
                404: {
                    description: "Attachment not found",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            scopes: ["write:media"],
            permissions: [RolePermission.ManageOwnMedia],
        }),
        validator(
            "form",
            z
                .object({
                    thumbnail: z.file().meta({
                        description:
                            "The custom thumbnail of the media to be attached, encoded using multipart form data.",
                    }),
                    description: AttachmentSchema.shape.description
                        .unwrap()
                        .max(config.validation.media.max_description_characters)
                        .optional(),
                    focus: z.string().meta({
                        description:
                            "Two floating points (x,y), comma-delimited, ranging from -1.0 to 1.0. Used for media cropping on clients.",
                        externalDocs: {
                            url: "https://docs.joinmastodon.org/api/guidelines/#focal-points",
                        },
                    }),
                })
                .partial(),
            handleZodError,
        ),
        validator(
            "param",
            z.object({
                id: AttachmentSchema.shape.id,
            }),
            handleZodError,
        ),
        async (context) => {
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
        },
    );
});
