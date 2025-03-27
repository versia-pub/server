import { apiRoute, auth, jsonOrForm } from "@/api";
import { mimeLookup } from "@/content_types";
import { createRoute, z } from "@hono/zod-openapi";
import { CustomEmoji as CustomEmojiSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Emoji, Media } from "@versia/kit/db";
import { Emojis } from "@versia/kit/tables";
import { and, eq, isNull, or } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";

const schema = z.object({
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
});

const route = createRoute({
    method: "post",
    path: "/api/v1/emojis",
    summary: "Upload emoji",
    description: "Upload a new emoji to the server.",
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermission.ManageOwnEmojis,
                RolePermission.ViewEmojis,
            ],
        }),
        jsonOrForm(),
    ] as const,
    request: {
        body: {
            content: {
                "application/json": {
                    schema,
                },
                "multipart/form-data": {
                    schema,
                },
                "application/x-www-form-urlencoded": {
                    schema,
                },
            },
        },
    },
    responses: {
        201: {
            description: "Uploaded emoji",
            content: {
                "application/json": {
                    schema: CustomEmojiSchema,
                },
            },
        },
        401: ApiError.missingAuthentication().schema,
        422: ApiError.validationFailed().schema,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { shortcode, element, alt, global, category } =
            context.req.valid("json");
        const { user } = context.get("auth");

        if (!user.hasPermission(RolePermission.ManageEmojis) && global) {
            throw new ApiError(
                401,
                "Missing permissions",
                `Only users with the '${RolePermission.ManageEmojis}' permission can upload global emojis`,
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

        const media =
            element instanceof File
                ? await Media.fromFile(element, {
                      description: alt ?? undefined,
                  })
                : await Media.fromUrl(element, {
                      description: alt ?? undefined,
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
