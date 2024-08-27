import {
    apiRoute,
    applyConfig,
    auth,
    emojiValidator,
    handleZodError,
    jsonOrForm,
} from "@/api";
import { mimeLookup } from "@/content_types";
import { response } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { MediaManager } from "~/classes/media/media-manager";
import { db } from "~/drizzle/db";
import { Emojis, RolePermissions } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { Attachment } from "~/packages/database-interface/attachment";
import { Emoji } from "~/packages/database-interface/emoji";

export const meta = applyConfig({
    allowedMethods: ["DELETE", "GET", "PATCH"],
    route: "/api/v1/emojis/:id",
    ratelimits: {
        max: 30,
        duration: 60,
    },
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnEmojis, RolePermissions.ViewEmojis],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z
        .object({
            shortcode: z
                .string()
                .trim()
                .min(1)
                .max(64)
                .regex(
                    emojiValidator,
                    "Shortcode must only contain letters (any case), numbers, dashes or underscores.",
                ),
            element: z
                .string()
                .trim()
                .min(1)
                .max(2000)
                .url()
                .or(z.instanceof(File)),
            category: z.string().max(64).optional(),
            alt: z.string().max(1000).optional(),
            global: z
                .string()
                .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
                .or(z.boolean())
                .optional(),
        })
        .partial()
        .optional(),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        jsonOrForm(),
        zValidator("param", schemas.param, handleZodError),
        zValidator("json", schemas.json, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");
            const { user } = context.req.valid("header");

            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            const emoji = await Emoji.fromId(id);

            if (!emoji) {
                return context.json({ error: "Emoji not found" }, 404);
            }

            // Check if user is admin
            if (
                !user.hasPermission(RolePermissions.ManageEmojis) &&
                emoji.data.ownerId !== user.data.id
            ) {
                return context.json(
                    {
                        error: `You cannot modify this emoji, as it is either global, not owned by you, or you do not have the '${RolePermissions.ManageEmojis}' permission to manage global emojis`,
                    },
                    403,
                );
            }

            const mediaManager = new MediaManager(config);

            switch (context.req.method) {
                case "DELETE": {
                    await mediaManager.deleteFileByUrl(emoji.data.url);

                    await db.delete(Emojis).where(eq(Emojis.id, id));

                    return response(null, 204);
                }

                case "PATCH": {
                    const form = context.req.valid("json");

                    if (!form) {
                        return context.json(
                            {
                                error: "Invalid form data (must supply at least one of: shortcode, element, alt, category)",
                            },
                            422,
                        );
                    }

                    if (
                        !(
                            form.shortcode ||
                            form.element ||
                            form.alt ||
                            form.category
                        ) &&
                        form.global === undefined
                    ) {
                        return context.json(
                            {
                                error: "Invalid form data (must supply at least one of: shortcode, element, alt, category)",
                            },
                            422,
                        );
                    }

                    if (
                        !user.hasPermission(RolePermissions.ManageEmojis) &&
                        form.global
                    ) {
                        return context.json(
                            {
                                error: `Only users with the '${RolePermissions.ManageEmojis}' permission can make an emoji global or not`,
                            },
                            401,
                        );
                    }

                    const modified = structuredClone(emoji.data);

                    if (form.element) {
                        // Check of emoji is an image
                        let contentType =
                            form.element instanceof File
                                ? form.element.type
                                : await mimeLookup(form.element);

                        if (!contentType.startsWith("image/")) {
                            return context.json(
                                {
                                    error: `Emojis must be images (png, jpg, gif, etc.). Detected: ${contentType}`,
                                },
                                422,
                            );
                        }

                        let url = "";

                        if (form.element instanceof File) {
                            const uploaded = await mediaManager.addFile(
                                form.element,
                            );

                            url = uploaded.path;
                            contentType = uploaded.uploadedFile.type;
                        } else {
                            url = form.element;
                        }

                        modified.url = Attachment.getUrl(url);
                        modified.contentType = contentType;
                    }

                    modified.shortcode = form.shortcode ?? modified.shortcode;
                    modified.alt = form.alt ?? modified.alt;
                    modified.category = form.category ?? modified.category;
                    modified.ownerId = form.global ? null : user.data.id;

                    await emoji.update(modified);

                    return context.json(emoji.toApi());
                }

                case "GET": {
                    return context.json(emoji.toApi());
                }
            }
        },
    ),
);
