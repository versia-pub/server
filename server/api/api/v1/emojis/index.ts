import {
    applyConfig,
    auth,
    emojiValidator,
    handleZodError,
    jsonOrForm,
} from "@/api";
import { mimeLookup } from "@/content_types";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { MediaManager } from "~/classes/media/media-manager";
import { Emojis, RolePermissions } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { Attachment } from "~/packages/database-interface/attachment";
import { Emoji } from "~/packages/database-interface/emoji";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    route: "/api/v1/emojis",
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
    json: z.object({
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
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        jsonOrForm(),
        zValidator("json", schemas.json, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { shortcode, element, alt, global, category } =
                context.req.valid("json");
            const { user } = context.req.valid("header");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            if (!user.hasPermission(RolePermissions.ManageEmojis) && global) {
                return errorResponse(
                    `Only users with the '${RolePermissions.ManageEmojis}' permission can upload global emojis`,
                    401,
                );
            }

            // Check if emoji already exists
            const existing = await Emoji.fromSql(
                and(
                    eq(Emojis.shortcode, shortcode),
                    isNull(Emojis.instanceId),
                    or(eq(Emojis.ownerId, user.id), isNull(Emojis.ownerId)),
                ),
            );

            if (existing) {
                return errorResponse(
                    `An emoji with the shortcode ${shortcode} already exists, either owned by you or global.`,
                    422,
                );
            }

            let url = "";

            // Check of emoji is an image
            let contentType =
                element instanceof File
                    ? element.type
                    : await mimeLookup(element);

            if (!contentType.startsWith("image/")) {
                return errorResponse(
                    `Emojis must be images (png, jpg, gif, etc.). Detected: ${contentType}`,
                    422,
                );
            }

            if (element instanceof File) {
                const mediaManager = new MediaManager(config);

                const uploaded = await mediaManager.addFile(element);

                url = uploaded.path;
                contentType = uploaded.uploadedFile.type;
            } else {
                url = element;
            }

            const emoji = await Emoji.insert({
                shortcode,
                url: Attachment.getUrl(url),
                visibleInPicker: true,
                ownerId: global ? null : user.id,
                category,
                contentType,
                alt,
            });

            return jsonResponse(emoji.toApi());
        },
    );
