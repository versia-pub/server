import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Attachment as AttachmentSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Media } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "post",
    path: "/api/v1/media",
    summary: "Upload media as an attachment (v1)",
    description:
        "Creates an attachment to be used with a new status. This method will return after the full sized media is done processing.",
    deprecated: true,
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/media/#v1",
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
        body: {
            content: {
                "multipart/form-data": {
                    schema: z.object({
                        file: z.instanceof(File).openapi({
                            description:
                                "The file to be attached, encoded using multipart form data. The file must have a MIME type.",
                        }),
                        thumbnail: z.instanceof(File).optional().openapi({
                            description:
                                "The custom thumbnail of the media to be attached, encoded using multipart form data.",
                        }),
                        description:
                            AttachmentSchema.shape.description.optional(),
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
                },
            },
        },
    },
    responses: {
        200: {
            description:
                "Attachment created successfully. Note that the MediaAttachment will be created even if the file is not understood correctly due to failed processing.",
            content: {
                "application/json": {
                    schema: AttachmentSchema,
                },
            },
        },
        413: {
            description: "File too large",
            content: {
                "application/json": {
                    schema: ApiError.zodSchema,
                },
            },
        },
        415: {
            description: "Disallowed file type",
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

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { file, thumbnail, description } = context.req.valid("form");

        const attachment = await Media.fromFile(file, {
            thumbnail,
            description: description ?? undefined,
        });

        return context.json(attachment.toApi(), 200);
    }),
);
