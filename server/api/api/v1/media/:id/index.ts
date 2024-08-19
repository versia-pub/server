import {
    apiRoute,
    applyConfig,
    auth,
    handleZodError,
    idValidator,
} from "@/api";
import { errorResponse, jsonResponse, response } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { MediaManager } from "~/classes/media/media-manager";
import { RolePermissions } from "~/drizzle/schema";
import { config } from "~/packages/config-manager/index";
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

export default apiRoute((app) =>
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

                    const mediaManager = new MediaManager(config);

                    if (thumbnail) {
                        const { path } = await mediaManager.addFile(thumbnail);
                        thumbnailUrl = Attachment.getUrl(path);
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
    ),
);
