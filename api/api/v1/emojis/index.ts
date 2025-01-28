import { apiRoute, auth, emojiValidator, jsonOrForm } from "@/api";
import { mimeLookup } from "@/content_types";
import { createRoute } from "@hono/zod-openapi";
import type { ContentFormat } from "@versia/federation/types";
import { Emoji, Media } from "@versia/kit/db";
import { Emojis, RolePermissions } from "@versia/kit/tables";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { MediaManager } from "~/classes/media/media-manager";
import { config } from "~/packages/config-manager";
import { ErrorSchema } from "~/types/api";

const schemas = {
    json: z.object({
        shortcode: z
            .string()
            .trim()
            .min(1)
            .max(config.validation.max_emoji_shortcode_size)
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
            .or(
                z
                    .instanceof(File)
                    .refine(
                        (v) => v.size <= config.validation.max_emoji_size,
                        `Emoji must be less than ${config.validation.max_emoji_size} bytes`,
                    ),
            ),
        category: z.string().max(64).optional(),
        alt: z
            .string()
            .max(config.validation.max_emoji_description_size)
            .optional(),
        global: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .or(z.boolean())
            .optional(),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/emojis",
    summary: "Upload emoji",
    description: "Upload an emoji",
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnEmojis,
                RolePermissions.ViewEmojis,
            ],
        }),
        jsonOrForm(),
    ] as const,
    request: {
        body: {
            content: {
                "application/json": {
                    schema: schemas.json,
                },
                "multipart/form-data": {
                    schema: schemas.json,
                },
                "application/x-www-form-urlencoded": {
                    schema: schemas.json,
                },
            },
        },
    },
    responses: {
        201: {
            description: "Uploaded emoji",
            content: {
                "application/json": {
                    schema: Emoji.schema,
                },
            },
        },

        422: {
            description: "Invalid data",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { shortcode, element, alt, global, category } =
            context.req.valid("json");
        const { user } = context.get("auth");

        if (!user.hasPermission(RolePermissions.ManageEmojis) && global) {
            throw new ApiError(
                401,
                "Missing permissions",
                `Only users with the '${RolePermissions.ManageEmojis}' permission can upload global emojis`,
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
            throw new ApiError(
                422,
                "Emoji already exists",
                `An emoji with the shortcode ${shortcode} already exists, either owned by you or global.`,
            );
        }

        // Check of emoji is an image
        const contentType =
            element instanceof File ? element.type : await mimeLookup(element);

        if (!contentType.startsWith("image/")) {
            throw new ApiError(
                422,
                "Invalid content type",
                `Emojis must be images (png, jpg, gif, etc.). Detected: ${contentType}`,
            );
        }

        let contentFormat: ContentFormat | undefined;

        if (element instanceof File) {
            const mediaManager = new MediaManager(config);

            const { uploadedFile, path } = await mediaManager.addFile(element);

            contentFormat = await Media.fileToContentFormat(
                uploadedFile,
                Media.getUrl(path),
                { description: alt },
            );
        } else {
            contentFormat = {
                [contentType]: {
                    content: element,
                    remote: true,
                    description: alt,
                },
            };
        }

        const media = await Media.insert({
            content: contentFormat,
        });

        const emoji = await Emoji.insert({
            shortcode,
            mediaId: media.id,
            visibleInPicker: true,
            ownerId: global ? null : user.id,
            category,
        });

        return context.json(emoji.toApi(), 201);
    }),
);
