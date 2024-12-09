import { apiRoute, applyConfig, auth, emojiValidator, jsonOrForm } from "@/api";
import { mimeLookup } from "@/content_types";
import { createRoute } from "@hono/zod-openapi";
import { Attachment, Emoji, db } from "@versia/kit/db";
import { Emojis, RolePermissions } from "@versia/kit/tables";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { MediaManager } from "~/classes/media/media-manager";
import { config } from "~/packages/config-manager";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
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
        })
        .partial(),
};

const routeGet = createRoute({
    method: "get",
    path: "/api/v1/emojis/{id}",
    summary: "Get emoji data",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Emoji",
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
        403: {
            description: "Insufficient credentials",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        404: {
            description: "Emoji not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

const routePatch = createRoute({
    method: "patch",
    path: "/api/v1/emojis/{id}",
    summary: "Modify emoji",
    middleware: [auth(meta.auth, meta.permissions), jsonOrForm()],
    request: {
        params: schemas.param,
        body: {
            content: {
                "application/json": {
                    schema: schemas.json,
                },
                "application/x-www-form-urlencoded": {
                    schema: schemas.json,
                },
                "multipart/form-data": {
                    schema: schemas.json,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Emoji modified",
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
        403: {
            description: "Insufficient credentials",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        404: {
            description: "Emoji not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        422: {
            description: "Invalid form data",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

const routeDelete = createRoute({
    method: "delete",
    path: "/api/v1/emojis/{id}",
    summary: "Delete emoji",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
    },
    responses: {
        204: {
            description: "Emoji deleted",
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        404: {
            description: "Emoji not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) => {
    app.openapi(routeGet, async (context) => {
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");

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

        return context.json(emoji.toApi(), 200);
    });

    app.openapi(routePatch, async (context) => {
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");

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

        const {
            global: emojiGlobal,
            alt,
            category,
            element,
            shortcode,
        } = context.req.valid("json");

        if (!user.hasPermission(RolePermissions.ManageEmojis) && emojiGlobal) {
            return context.json(
                {
                    error: `Only users with the '${RolePermissions.ManageEmojis}' permission can make an emoji global or not`,
                },
                401,
            );
        }

        const modified = structuredClone(emoji.data);

        if (element) {
            // Check of emoji is an image
            let contentType =
                element instanceof File
                    ? element.type
                    : await mimeLookup(element);

            if (!contentType.startsWith("image/")) {
                return context.json(
                    {
                        error: `Emojis must be images (png, jpg, gif, etc.). Detected: ${contentType}`,
                    },
                    422,
                );
            }

            let url = "";

            if (element instanceof File) {
                const uploaded = await mediaManager.addFile(element);

                url = uploaded.path;
                contentType = uploaded.uploadedFile.type;
            } else {
                url = element;
            }

            modified.url = Attachment.getUrl(url);
            modified.contentType = contentType;
        }

        modified.shortcode = shortcode ?? modified.shortcode;
        modified.alt = alt ?? modified.alt;
        modified.category = category ?? modified.category;

        if (emojiGlobal !== undefined) {
            modified.ownerId = emojiGlobal ? null : user.data.id;
        }

        await emoji.update(modified);

        return context.json(emoji.toApi(), 200);
    });

    app.openapi(routeDelete, async (context) => {
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");

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
                    error: `You cannot delete this emoji, as it is either global, not owned by you, or you do not have the '${RolePermissions.ManageEmojis}' permission to manage global emojis`,
                },
                403,
            );
        }

        const mediaManager = new MediaManager(config);

        await mediaManager.deleteFileByUrl(emoji.data.url);

        await db.delete(Emojis).where(eq(Emojis.id, id));

        return context.text("", 204);
    });
});
