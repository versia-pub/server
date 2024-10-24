import { apiRoute, applyConfig, auth, emojiValidator, jsonOrForm } from "@/api";
import { mimeLookup } from "@/content_types";
import { createRoute } from "@hono/zod-openapi";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { Attachment } from "~/classes/database/attachment";
import { Emoji } from "~/classes/database/emoji";
import { MediaManager } from "~/classes/media/media-manager";
import { Emojis, RolePermissions } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
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

const route = createRoute({
    method: "post",
    path: "/api/v1/emojis",
    summary: "Upload emoji",
    description: "Upload an emoji",
    middleware: [auth(meta.auth, meta.permissions), jsonOrForm()],
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
        200: {
            description: "uploaded emoji",
            content: {
                "application/json": {
                    schema: Emoji.schema,
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
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

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        if (!user.hasPermission(RolePermissions.ManageEmojis) && global) {
            return context.json(
                {
                    error: `Only users with the '${RolePermissions.ManageEmojis}' permission can upload global emojis`,
                },
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
            return context.json(
                {
                    error: `An emoji with the shortcode ${shortcode} already exists, either owned by you or global.`,
                },
                422,
            );
        }

        let url = "";

        // Check of emoji is an image
        let contentType =
            element instanceof File ? element.type : await mimeLookup(element);

        if (!contentType.startsWith("image/")) {
            return context.json(
                {
                    error: `Emojis must be images (png, jpg, gif, etc.). Detected: ${contentType}`,
                },
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

        return context.json(emoji.toApi(), 200);
    }),
);
