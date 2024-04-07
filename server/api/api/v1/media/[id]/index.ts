import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import type { MediaBackend } from "media-manager";
import { MediaBackendType } from "media-manager";
import { client } from "~database/datasource";
import { attachmentToAPI, getUrl } from "~database/entities/Attachment";
import { LocalMediaBackend, S3MediaBackend } from "~packages/media-manager";

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
});

/**
 * Get media information
 */
export default apiRoute<{
    thumbnail?: File;
    description?: string;
    focus?: string;
}>(async (req, matchedRoute, extraData) => {
    const { user } = extraData.auth;

    if (!user) {
        return errorResponse("Unauthorized", 401);
    }

    const id = matchedRoute.params.id;

    const attachment = await client.attachment.findUnique({
        where: {
            id,
        },
    });

    if (!attachment) {
        return errorResponse("Media not found", 404);
    }

    const config = await extraData.configManager.getConfig();

    switch (req.method) {
        case "GET": {
            if (attachment.url) {
                return jsonResponse(attachmentToAPI(attachment));
            }
            return new Response(null, {
                status: 206,
            });
        }
        case "PUT": {
            const { description, thumbnail } = extraData.parsedRequest;

            let thumbnailUrl = attachment.thumbnail_url;

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
                const { uploadedFile } = await mediaManager.addFile(thumbnail);
                thumbnailUrl = getUrl(uploadedFile.name, config);
            }

            const descriptionText = description || attachment.description;

            if (
                descriptionText !== attachment.description ||
                thumbnailUrl !== attachment.thumbnail_url
            ) {
                const newAttachment = await client.attachment.update({
                    where: {
                        id,
                    },
                    data: {
                        description: descriptionText,
                        thumbnail_url: thumbnailUrl,
                    },
                });

                return jsonResponse(attachmentToAPI(newAttachment));
            }

            return jsonResponse(attachmentToAPI(attachment));
        }
    }

    return errorResponse("Method not allowed", 405);
});
