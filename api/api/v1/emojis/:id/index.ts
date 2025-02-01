import { apiRoute, auth, emojiValidator, jsonOrForm } from "@/api";
import { mimeLookup } from "@/content_types";
import { createRoute } from "@hono/zod-openapi";
import { Emoji } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/packages/config-manager";
import { ErrorSchema } from "~/types/api";

const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z
        .object({
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
                .transform((a) => new URL(a))
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
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ViewEmojis],
        }),
    ] as const,
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
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnEmojis,
                RolePermissions.ViewEmojis,
            ],
        }),
    ] as const,
    request: {
        params: schemas.param,
    },
    responses: {
        204: {
            description: "Emoji deleted",
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

        const emoji = await Emoji.fromId(id);

        if (!emoji) {
            throw new ApiError(404, "Emoji not found");
        }

        // Don't leak non-global emojis to non-admins
        if (
            !user.hasPermission(RolePermissions.ManageEmojis) &&
            emoji.data.ownerId !== user.data.id
        ) {
            throw new ApiError(404, "Emoji not found");
        }

        return context.json(emoji.toApi(), 200);
    });

    app.openapi(routePatch, async (context) => {
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");

        const emoji = await Emoji.fromId(id);

        if (!emoji) {
            throw new ApiError(404, "Emoji not found");
        }

        // Check if user is admin
        if (
            !user.hasPermission(RolePermissions.ManageEmojis) &&
            emoji.data.ownerId !== user.data.id
        ) {
            throw new ApiError(
                403,
                "Cannot modify emoji not owned by you",
                `This emoji is either global (and you do not have the '${RolePermissions.ManageEmojis}' permission) or not owned by you`,
            );
        }

        const {
            global: emojiGlobal,
            alt,
            category,
            element,
            shortcode,
        } = context.req.valid("json");

        if (!user.hasPermission(RolePermissions.ManageEmojis) && emojiGlobal) {
            throw new ApiError(
                401,
                "Missing permissions",
                `'${RolePermissions.ManageEmojis}' permission is needed to upload global emojis`,
            );
        }

        if (element) {
            // Check of emoji is an image
            const contentType =
                element instanceof File
                    ? element.type
                    : await mimeLookup(element);

            if (!contentType.startsWith("image/")) {
                throw new ApiError(
                    422,
                    "Invalid content type",
                    `Emojis must be images (png, jpg, gif, etc.). Detected: ${contentType}`,
                );
            }

            if (element instanceof File) {
                await emoji.media.updateFromFile(element);
            } else {
                await emoji.media.updateFromUrl(element);
            }
        }

        if (alt) {
            await emoji.media.updateMetadata({
                description: alt,
            });
        }

        await emoji.update({
            shortcode,
            ownerId: emojiGlobal ? null : user.data.id,
            category,
        });

        return context.json(emoji.toApi(), 200);
    });

    app.openapi(routeDelete, async (context) => {
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");

        const emoji = await Emoji.fromId(id);

        if (!emoji) {
            throw new ApiError(404, "Emoji not found");
        }

        // Check if user is admin
        if (
            !user.hasPermission(RolePermissions.ManageEmojis) &&
            emoji.data.ownerId !== user.data.id
        ) {
            throw new ApiError(
                403,
                "Cannot delete emoji not owned by you",
                `This emoji is either global (and you do not have the '${RolePermissions.ManageEmojis}' permission) or not owned by you`,
            );
        }

        await emoji.delete();

        return context.body(null, 204);
    });
});
