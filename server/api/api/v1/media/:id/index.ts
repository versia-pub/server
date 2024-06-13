import { applyConfig, auth, handleZodError, idValidator } from "@/api";
import { errorResponse, jsonResponse, response } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { config } from "config-manager";
import type { Hono } from "hono";
import type { MediaBackend } from "media-manager";
import { MediaBackendType } from "media-manager";
import { LocalMediaBackend, S3MediaBackend } from "media-manager";
import { z } from "zod";
import { getUrl } from "~/database/entities/attachment";
import { RolePermissions } from "~/drizzle/schema";
import { Attachment } from "~/packages/database-interface/attachment";

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
        required: [RolePermissions.ManageOwnMedia],
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

            const attachment = await Attachment.fromId(id);

            if (!attachment) {
                return errorResponse("Media not found", 404);
            }

            switch (context.req.method) {
                case "GET": {
                    if (attachment.data.url) {
                        return jsonResponse(attachment.toApi());
                    }
                    return response(null, 206);
                }
                case "PUT": {
                    const { description, thumbnail } =
                        context.req.valid("form");

                    let thumbnailUrl = attachment.data.thumbnailUrl;

                    let mediaManager: MediaBackend;

                    switch (config.media.backend as MediaBackendType) {
                        case MediaBackendType.Local:
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
                        description || attachment.data.description;

                    if (
                        descriptionText !== attachment.data.description ||
                        thumbnailUrl !== attachment.data.thumbnailUrl
                    ) {
                        await attachment.update({
                            description: descriptionText,
                            thumbnailUrl,
                        });

                        return jsonResponse(attachment.toApi());
                    }

                    return jsonResponse(attachment.toApi());
                }
            }

            return errorResponse("Method not allowed", 405);
        },
    );
