import {
    applyConfig,
    auth,
    emojiValidator,
    handleZodError,
    jsonOrForm,
} from "@api";
import { mimeLookup } from "@content_types";
import { zValidator } from "@hono/zod-validator";
import { errorResponse, jsonResponse } from "@response";
import type { Hono } from "hono";
import { z } from "zod";
import { getUrl } from "~database/entities/Attachment";
import { emojiToAPI } from "~database/entities/Emoji";
import { db } from "~drizzle/db";
import { Emojis } from "~drizzle/schema";
import { config } from "~packages/config-manager";
import { MediaBackend } from "~packages/media-manager";

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
});

export const schemas = {
    form: z.object({
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
        zValidator("form", schemas.form, handleZodError),
        auth(meta.auth),
        async (context) => {
            const { shortcode, element, alt, global, category } =
                context.req.valid("form");
            const { user } = context.req.valid("header");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            if (!user.getUser().isAdmin && global) {
                return errorResponse(
                    "Only administrators can upload global emojis",
                    401,
                );
            }

            // Check if emoji already exists
            const existing = await db.query.Emojis.findFirst({
                where: (emoji, { eq, and, isNull, or }) =>
                    and(
                        eq(emoji.shortcode, shortcode),
                        isNull(emoji.instanceId),
                        or(eq(emoji.ownerId, user.id), isNull(emoji.ownerId)),
                    ),
            });

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
                const media = await MediaBackend.fromBackendType(
                    config.media.backend,
                    config,
                );

                const uploaded = await media.addFile(element);

                url = uploaded.path;
                contentType = uploaded.uploadedFile.type;
            } else {
                url = element;
            }

            const emoji = (
                await db
                    .insert(Emojis)
                    .values({
                        shortcode,
                        url: getUrl(url, config),
                        visibleInPicker: true,
                        ownerId: global ? null : user.id,
                        category,
                        contentType,
                        alt,
                    })
                    .returning()
            )[0];

            return jsonResponse(
                emojiToAPI({
                    ...emoji,
                    instance: null,
                }),
            );
        },
    );
