import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { encode } from "blurhash";
import { config } from "config-manager";
import type { Hono } from "hono";
import { MediaBackendType } from "media-manager";
import type { MediaBackend } from "media-manager";
import { LocalMediaBackend, S3MediaBackend } from "media-manager";
import sharp from "sharp";
import { z } from "zod";
import { getUrl } from "~/database/entities/attachment";
import { RolePermissions } from "~/drizzle/schema";
import { Attachment } from "~/packages/database-interface/attachment";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 10,
        duration: 60,
    },
    route: "/api/v1/media",
    auth: {
        required: true,
        oauthPermissions: ["write:media"],
    },
    permissions: {
        required: [RolePermissions.ManageOwnMedia],
    },
});

export const schemas = {
    form: z.object({
        file: z.instanceof(File),
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
        zValidator("form", schemas.form, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { file, thumbnail, description } = context.req.valid("form");

            if (file.size > config.validation.max_media_size) {
                return errorResponse(
                    `File too large, max size is ${config.validation.max_media_size} bytes`,
                    413,
                );
            }

            if (
                config.validation.enforce_mime_types &&
                !config.validation.allowed_mime_types.includes(file.type)
            ) {
                return errorResponse("Invalid file type", 415);
            }

            const sha256 = new Bun.SHA256();

            const isImage = file.type.startsWith("image/");

            const metadata = isImage
                ? await sharp(await file.arrayBuffer()).metadata()
                : null;

            const blurhash = await new Promise<string | null>((resolve) => {
                (async () =>
                    sharp(await file.arrayBuffer())
                        .raw()
                        .ensureAlpha()
                        .toBuffer((err, buffer) => {
                            if (err) {
                                resolve(null);
                                return;
                            }

                            try {
                                resolve(
                                    encode(
                                        new Uint8ClampedArray(buffer),
                                        metadata?.width ?? 0,
                                        metadata?.height ?? 0,
                                        4,
                                        4,
                                    ) as string,
                                );
                            } catch {
                                resolve(null);
                            }
                        }))();
            });

            let url = "";

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

            const { path } = await mediaManager.addFile(file);

            url = getUrl(path, config);

            let thumbnailUrl = "";

            if (thumbnail) {
                const { path } = await mediaManager.addFile(thumbnail);

                thumbnailUrl = getUrl(path, config);
            }

            const newAttachment = await Attachment.insert({
                url,
                thumbnailUrl,
                sha256: sha256.update(await file.arrayBuffer()).digest("hex"),
                mimeType: file.type,
                description: description ?? "",
                size: file.size,
                blurhash: blurhash ?? undefined,
                width: metadata?.width ?? undefined,
                height: metadata?.height ?? undefined,
            });

            // TODO: Add job to process videos and other media

            return jsonResponse(newAttachment.toApi());
        },
    );
