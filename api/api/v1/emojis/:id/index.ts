import {
    apiRoute,
    auth,
    jsonOrForm,
    reusedResponses,
    withEmojiParam,
} from "@/api";
import { mimeLookup } from "@/content_types";
import { createRoute, z } from "@hono/zod-openapi";
import { RolePermissions } from "@versia/kit/tables";
import { ApiError } from "~/classes/errors/api-error";
import { CustomEmoji as CustomEmojiSchema } from "~/classes/schemas/emoji";
import { config } from "~/packages/config-manager";
import { ErrorSchema } from "~/types/api";

const schema = z
    .object({
        shortcode: CustomEmojiSchema.shape.shortcode,
        element: z
            .string()
            .url()
            .transform((a) => new URL(a))
            .openapi({
                description: "Emoji image URL",
            })
            .or(
                z
                    .instanceof(File)
                    .openapi({
                        description:
                            "Emoji image encoded using multipart/form-data",
                    })
                    .refine(
                        (v) => v.size <= config.validation.max_emoji_size,
                        `Emoji must be less than ${config.validation.max_emoji_size} bytes`,
                    ),
            ),
        category: CustomEmojiSchema.shape.category.optional(),
        alt: CustomEmojiSchema.shape.description.optional(),
        global: CustomEmojiSchema.shape.global.default(false),
    })
    .partial();

const routeGet = createRoute({
    method: "get",
    path: "/api/v1/emojis/{id}",
    summary: "Get emoji",
    description: "Retrieves a custom emoji from database by ID.",
    tags: ["Emojis"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ViewEmojis],
        }),
        withEmojiParam,
    ] as const,
    request: {
        params: z.object({
            id: CustomEmojiSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description: "Emoji",
            content: {
                "application/json": {
                    schema: CustomEmojiSchema,
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
        ...reusedResponses,
    },
});

const routePatch = createRoute({
    method: "patch",
    path: "/api/v1/emojis/{id}",
    summary: "Modify emoji",
    description: "Edit image or metadata of an emoji.",
    tags: ["Emojis"],
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnEmojis,
                RolePermissions.ViewEmojis,
            ],
        }),
        jsonOrForm(),
        withEmojiParam,
    ] as const,
    request: {
        params: z.object({
            id: CustomEmojiSchema.shape.id,
        }),
        body: {
            content: {
                "application/json": {
                    schema: schema,
                },
                "application/x-www-form-urlencoded": {
                    schema: schema,
                },
                "multipart/form-data": {
                    schema: schema,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Emoji modified",
            content: {
                "application/json": {
                    schema: CustomEmojiSchema,
                },
            },
        },
        403: {
            description: "Insufficient permissions",
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
        ...reusedResponses,
    },
});

const routeDelete = createRoute({
    method: "delete",
    path: "/api/v1/emojis/{id}",
    summary: "Delete emoji",
    description: "Delete a custom emoji from the database.",
    tags: ["Emojis"],
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnEmojis,
                RolePermissions.ViewEmojis,
            ],
        }),
        withEmojiParam,
    ] as const,
    request: {
        params: z.object({
            id: CustomEmojiSchema.shape.id,
        }),
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
    app.openapi(routeGet, (context) => {
        const { user } = context.get("auth");
        const emoji = context.get("emoji");

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
        const { user } = context.get("auth");
        const emoji = context.get("emoji");

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
            // Check if emoji is an image
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
        const { user } = context.get("auth");
        const emoji = context.get("emoji");

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
