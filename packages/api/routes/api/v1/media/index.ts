import {
    Attachment as AttachmentSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { apiRoute, auth, handleZodError } from "@versia/kit/api";
import { Media } from "@versia/kit/db";
import { config } from "@versia-server/config";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";

export default apiRoute((app) =>
    app.post(
        "/api/v1/media",
        describeRoute({
            summary: "Upload media as an attachment (v1)",
            description:
                "Creates an attachment to be used with a new status. This method will return after the full sized media is done processing.",
            deprecated: true,
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/media/#v1",
            },
            tags: ["Media"],
            responses: {
                200: {
                    description:
                        "Attachment created successfully. Note that the MediaAttachment will be created even if the file is not understood correctly due to failed processing.",
                    content: {
                        "application/json": {
                            schema: resolver(AttachmentSchema),
                        },
                    },
                },
                413: {
                    description: "File too large",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
                415: {
                    description: "Disallowed file type",
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
                file: z.instanceof(File).openapi({
                    description:
                        "The file to be attached, encoded using multipart form data. The file must have a MIME type.",
                }),
                thumbnail: z.instanceof(File).optional().openapi({
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
                    .openapi({
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
