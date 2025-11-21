import {
    Attachment as AttachmentSchema,
    RolePermission,
} from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { Media } from "@versia-server/kit/db";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

export default apiRoute((app) =>
    app.post(
        "/api/v2/media",
        describeRoute({
            summary: "Upload media as an attachment (async)",
            description:
                "Creates a media attachment to be used with a new status. The full sized media will be processed asynchronously in the background for large uploads.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/media/#v2",
            },
            tags: ["Media"],
            responses: {
                200: {
                    description:
                        "MediaAttachment was created successfully, and the full-size file was processed synchronously.",
                    content: {
                        "application/json": {
                            schema: resolver(AttachmentSchema),
                        },
                    },
                },
                202: {
                    description:
                        "MediaAttachment was created successfully, but the full-size file is still processing. Note that the MediaAttachment’s url will still be null, as the media is still being processed in the background. However, the preview_url should be available. Use GET /api/v1/media/:id to check the status of the media attachment.",
                    content: {
                        "application/json": {
                            // FIXME: Can't .extend the type to have a null url because it crashes zod-to-openapi
                            schema: resolver(AttachmentSchema),
                        },
                    },
                },
                413: {
                    description: "Payload too large",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
                415: {
                    description: "Unsupported media type",
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
            z.object({
                file: z.file().meta({
                    description:
                        "The file to be attached, encoded using multipart form data. The file must have a MIME type.",
                }),
                thumbnail: z.file().optional().meta({
                    description:
                        "The custom thumbnail of the media to be attached, encoded using multipart form data.",
                }),
                description: AttachmentSchema.shape.description
                    .unwrap()
                    .max(config.validation.media.max_description_characters)
                    .optional(),
                focus: z
                    .string()
                    .optional()
                    .meta({
                        description:
                            "Two floating points (x,y), comma-delimited, ranging from -1.0 to 1.0. Used for media cropping on clients.",
                        externalDocs: {
                            url: "https://docs.joinmastodon.org/api/guidelines/#focal-points",
                        },
                    }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { file, thumbnail, description } = context.req.valid("form");

            const attachment = await Media.fromFile(file, {
                thumbnail,
                description: description ?? undefined,
            });

            return context.json(attachment.toApi(), 200);
        },
    ),
);
