import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Attachment as AttachmentSchema } from "@versia/client-ng/schemas";
import { Media } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { ErrorSchema } from "~/types/api";

const route = createRoute({
    method: "post",
    path: "/api/v2/media",
    summary: "Upload media as an attachment (async)",
    description:
        "Creates a media attachment to be used with a new status. The full sized media will be processed asynchronously in the background for large uploads.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/media/#v2",
    },
    tags: ["Media"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:media"],
            permissions: [RolePermissions.ManageOwnMedia],
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
                "MediaAttachment was created successfully, and the full-size file was processed synchronously.",
            content: {
                "application/json": {
                    schema: AttachmentSchema,
                },
            },
        },
        202: {
            description:
                "MediaAttachment was created successfully, but the full-size file is still processing. Note that the MediaAttachment’s url will still be null, as the media is still being processed in the background. However, the preview_url should be available. Use GET /api/v1/media/:id to check the status of the media attachment.",
            content: {
                "application/json": {
                    // FIXME: Can't .extend the type to have a null url because it crashes zod-to-openapi
                    schema: AttachmentSchema,
                },
            },
        },
        413: {
            description: "Payload too large",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        415: {
            description: "Unsupported media type",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        ...reusedResponses,
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
