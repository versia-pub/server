import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse, response } from "@response";
import { eq } from "drizzle-orm";
import type { MediaBackend } from "media-manager";
import { MediaBackendType } from "media-manager";
import { attachmentToAPI, getUrl } from "~database/entities/Attachment";
import { db } from "~drizzle/db";
import { attachment } from "~drizzle/schema";
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

    const foundAttachment = await db.query.attachment.findFirst({
        where: (attachment, { eq }) => eq(attachment.id, id),
    });

    if (!foundAttachment) {
        return errorResponse("Media not found", 404);
    }

    const config = await extraData.configManager.getConfig();

    switch (req.method) {
        case "GET": {
            if (foundAttachment.url) {
                return jsonResponse(attachmentToAPI(foundAttachment));
            }
            return response(null, 206);
        }
        case "PUT": {
            const { description, thumbnail } = extraData.parsedRequest;

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

            const descriptionText = description || foundAttachment.description;

            if (
                descriptionText !== foundAttachment.description ||
                thumbnailUrl !== foundAttachment.thumbnailUrl
            ) {
                const newAttachment = (
                    await db
                        .update(attachment)
                        .set({
                            description: descriptionText,
                            thumbnailUrl,
                        })
                        .where(eq(attachment.id, id))
                        .returning()
                )[0];

                return jsonResponse(attachmentToAPI(newAttachment));
            }

            return jsonResponse(attachmentToAPI(foundAttachment));
        }
    }

    return errorResponse("Method not allowed", 405);
});
