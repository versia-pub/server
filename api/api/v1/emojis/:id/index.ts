import { apiRoute, auth, jsonOrForm, withEmojiParam } from "@/api";
import { mimeLookup } from "@/content_types";
import { createRoute, z } from "@hono/zod-openapi";
import { CustomEmoji as CustomEmojiSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";

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
                        (v) => v.size <= config.validation.emojis.max_bytes,
                        `Emoji must be less than ${config.validation.emojis.max_bytes} bytes`,
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
            permissions: [RolePermission.ViewEmojis],
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
                    schema: ApiError.zodSchema,
                },
            },
        },
        401: ApiError.missingAuthentication().schema,
        422: ApiError.validationFailed().schema,
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
                RolePermission.ManageOwnEmojis,
                RolePermission.ViewEmojis,
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
                    schema,
                },
                "application/x-www-form-urlencoded": {
                    schema,
                },
                "multipart/form-data": {
                    schema,
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
                    schema: ApiError.zodSchema,
                },
            },
        },
        404: {
            description: "Emoji not found",
            content: {
                "application/json": {
                    schema: ApiError.zodSchema,
                },
            },
        },
        401: ApiError.missingAuthentication().schema,
        422: ApiError.validationFailed().schema,
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
                RolePermission.ManageOwnEmojis,
                RolePermission.ViewEmojis,
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
        404: ApiError.emojiNotFound().schema,
    },
});

export default apiRoute((app) => {
    app.openapi(routeGet, (context) => {
        const { user } = context.get("auth");
        const emoji = context.get("emoji");

        // Don't leak non-global emojis to non-admins
        if (
            !user.hasPermission(RolePermission.ManageEmojis) &&
            emoji.data.ownerId !== user.data.id
        ) {
            throw ApiError.emojiNotFound();
        }

        return context.json(emoji.toApi(), 200);
    });

    app.openapi(routePatch, async (context) => {
        const { user } = context.get("auth");
        const emoji = context.get("emoji");

        // Check if user is admin
        if (
            !user.hasPermission(RolePermission.ManageEmojis) &&
            emoji.data.ownerId !== user.data.id
        ) {
            throw new ApiError(
                403,
                "Cannot modify emoji not owned by you",
                `This emoji is either global (and you do not have the '${RolePermission.ManageEmojis}' permission) or not owned by you`,
            );
        }

        const {
            global: emojiGlobal,
            alt,
            category,
            element,
            shortcode,
        } = context.req.valid("json");

        if (!user.hasPermission(RolePermission.ManageEmojis) && emojiGlobal) {
            throw new ApiError(
                401,
                "Missing permissions",
                `'${RolePermission.ManageEmojis}' permission is needed to upload global emojis`,
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
            !user.hasPermission(RolePermission.ManageEmojis) &&
            emoji.data.ownerId !== user.data.id
        ) {
            throw new ApiError(
                403,
                "Cannot delete emoji not owned by you",
                `This emoji is either global (and you do not have the '${RolePermission.ManageEmojis}' permission) or not owned by you`,
            );
        }

        await emoji.delete();

        return context.body(null, 204);
    });
});
