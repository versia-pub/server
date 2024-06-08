import { applyConfig, auth, handleZodError, idValidator } from "@/api";
import { errorResponse, jsonResponse, response } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { config } from "config-manager";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { MediaBackend } from "media-manager";
import { MediaBackendType } from "media-manager";
import { LocalMediaBackend, S3MediaBackend } from "media-manager";
import { z } from "zod";
import { attachmentToAPI, getUrl } from "~/database/entities/Attachment";
import { db } from "~/drizzle/db";
import { Attachments, RolePermissions } from "~/drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["GET", "PUT"],
    ratelimits: {
        max: 10,
        duration: 60,
    },
    route: "/api/v1/media/:id",
    auth: {
        required: true,
        oauthPermissions: ["write:media"],
    },
    permissions: {
        required: [RolePermissions.MANAGE_OWN_MEDIA],
    },
});

export const schemas = {
    param: z.object({
        id: z.string(),
    }),
    form: z.object({
        thumbnail: z.instanceof(File).optional(),
        description: z
            .string()
            .max(config.validation.max_media_description_size)
            .optional(),
        focus: z.string().optional(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        zValidator("form", schemas.form, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");

            if (!id.match(idValidator)) {
                return errorResponse("Invalid ID, must be of type UUIDv7", 404);
            }

            const foundAttachment = await db.query.Attachments.findFirst({
                where: (attachment, { eq }) => eq(attachment.id, id),
            });

            if (!foundAttachment) {
                return errorResponse("Media not found", 404);
            }

            switch (context.req.method) {
                case "GET": {
                    if (foundAttachment.url) {
                        return jsonResponse(attachmentToAPI(foundAttachment));
                    }
                    return response(null, 206);
                }
                case "PUT": {
                    const { description, thumbnail } =
                        context.req.valid("form");

                    let thumbnailUrl = foundAttachment.thumbnailUrl;

                    let mediaManager: MediaBackend;

                    switch (config.media.backend as MediaBackendType) {
                        case MediaBackendType.LOCAL:
                            mediaManager = new LocalMediaBackend(config);
                            break;
                        case MediaBackendType.S3:
                            mediaManager = new S3MediaBackend(config);
                            break;
                        default:
                            // TODO: Replace with logger
                            throw new Error("Invalid media backend");
                    }

                    if (thumbnail) {
                        const { path } = await mediaManager.addFile(thumbnail);
                        thumbnailUrl = getUrl(path, config);
                    }

                    const descriptionText =
                        description || foundAttachment.description;

                    if (
                        descriptionText !== foundAttachment.description ||
                        thumbnailUrl !== foundAttachment.thumbnailUrl
                    ) {
                        const newAttachment = (
                            await db
                                .update(Attachments)
                                .set({
                                    description: descriptionText,
                                    thumbnailUrl,
                                })
                                .where(eq(Attachments.id, id))
                                .returning()
                        )[0];

                        return jsonResponse(attachmentToAPI(newAttachment));
                    }

                    return jsonResponse(attachmentToAPI(foundAttachment));
                }
            }

            return errorResponse("Method not allowed", 405);
        },
    );
