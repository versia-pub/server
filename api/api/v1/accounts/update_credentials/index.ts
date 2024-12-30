import { apiRoute, applyConfig, auth, jsonOrForm } from "@/api";
import { mimeLookup } from "@/content_types";
import { mergeAndDeduplicate } from "@/lib";
import { sanitizedHtmlStrip } from "@/sanitization";
import { createRoute } from "@hono/zod-openapi";
import { Attachment, Emoji, User } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import ISO6391 from "iso-639-1";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { contentToHtml } from "~/classes/functions/status";
import { MediaManager } from "~/classes/media/media-manager";
import { config } from "~/packages/config-manager/index.ts";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    route: "/api/v1/accounts/update_credentials",
    ratelimits: {
        max: 2,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["write:accounts"],
    },
    permissions: {
        required: [RolePermissions.ManageOwnAccount],
    },
});

export const schemas = {
    json: z.object({
        display_name: z
            .string()
            .min(3)
            .trim()
            .max(config.validation.max_displayname_size)
            .refine(
                (s) =>
                    !config.filters.displayname.some((filter) =>
                        s.match(filter),
                    ),
                "Display name contains blocked words",
            )
            .optional(),
        username: z
            .string()
            .min(3)
            .trim()
            .max(config.validation.max_username_size)
            .toLowerCase()
            .regex(
                /^[a-z0-9_-]+$/,
                "Username can only contain letters, numbers, underscores and hyphens",
            )
            .refine(
                (s) =>
                    !config.filters.username.some((filter) => s.match(filter)),
                "Username contains blocked words",
            )
            .optional(),
        note: z
            .string()
            .min(0)
            .max(config.validation.max_bio_size)
            .trim()
            .refine(
                (s) => !config.filters.bio.some((filter) => s.match(filter)),
                "Bio contains blocked words",
            )
            .optional(),
        avatar: z
            .string()
            .trim()
            .min(1)
            .max(2000)
            .url()
            .or(
                z
                    .instanceof(File)
                    .refine(
                        (v) => v.size <= config.validation.max_avatar_size,
                        `Avatar must be less than ${config.validation.max_avatar_size} bytes`,
                    ),
            )
            .optional(),
        header: z
            .string()
            .trim()
            .min(1)
            .max(2000)
            .url()
            .or(
                z
                    .instanceof(File)
                    .refine(
                        (v) => v.size <= config.validation.max_header_size,
                        `Header must be less than ${config.validation.max_header_size} bytes`,
                    ),
            )
            .optional(),
        locked: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        bot: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        discoverable: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        source: z
            .object({
                privacy: z
                    .enum(["public", "unlisted", "private", "direct"])
                    .optional(),
                sensitive: z
                    .string()
                    .transform((v) =>
                        ["true", "1", "on"].includes(v.toLowerCase()),
                    )
                    .optional(),
                language: z
                    .enum(ISO6391.getAllCodes() as [string, ...string[]])
                    .optional(),
            })
            .optional(),
        fields_attributes: z
            .array(
                z.object({
                    name: z
                        .string()
                        .trim()
                        .max(config.validation.max_field_name_size),
                    value: z
                        .string()
                        .trim()
                        .max(config.validation.max_field_value_size),
                }),
            )
            .max(config.validation.max_field_count)
            .optional(),
    }),
};

const route = createRoute({
    method: "patch",
    path: "/api/v1/accounts/update_credentials",
    summary: "Update credentials",
    description: "Update user credentials",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnAccount],
            scopes: ["write:accounts"],
        }),
        jsonOrForm(),
    ] as const,
    request: {
        body: {
            content: {
                "application/json": {
                    schema: schemas.json,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Updated user",
            content: {
                "application/json": {
                    schema: User.schema,
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
            description: "Validation error",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        500: {
            description: "Couldn't edit user",
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
        const { user } = context.get("auth");
        const {
            display_name,
            username,
            note,
            avatar,
            header,
            locked,
            bot,
            discoverable,
            source,
            fields_attributes,
        } = context.req.valid("json");

        if (!user) {
            throw new ApiError(401, "Unauthorized");
        }

        const self = user.data;

        const sanitizedDisplayName = await sanitizedHtmlStrip(
            display_name ?? "",
        );

        const mediaManager = new MediaManager(config);

        if (display_name) {
            self.displayName = sanitizedDisplayName;
        }

        if (note && self.source) {
            self.source.note = note;
            self.note = await contentToHtml({
                "text/markdown": {
                    content: note,
                    remote: false,
                },
            });
        }

        if (source?.privacy) {
            self.source.privacy = source.privacy;
        }

        if (source?.sensitive) {
            self.source.sensitive = source.sensitive;
        }

        if (source?.language) {
            self.source.language = source.language;
        }

        if (username) {
            // Check if username is already taken
            const existingUser = await User.fromSql(
                and(isNull(Users.instanceId), eq(Users.username, username)),
            );

            if (existingUser) {
                throw new ApiError(422, "Username is already taken");
            }

            self.username = username;
        }

        if (avatar) {
            if (avatar instanceof File) {
                const { path, uploadedFile } =
                    await mediaManager.addFile(avatar);
                const contentType = uploadedFile.type;

                self.avatar = Attachment.getUrl(path);
                self.source.avatar = {
                    content_type: contentType,
                };
            } else {
                self.avatar = avatar;
                self.source.avatar = {
                    content_type: await mimeLookup(avatar),
                };
            }
        }

        if (header) {
            if (header instanceof File) {
                const { path, uploadedFile } =
                    await mediaManager.addFile(header);
                const contentType = uploadedFile.type;

                self.header = Attachment.getUrl(path);
                self.source.header = {
                    content_type: contentType,
                };
            } else {
                self.header = header;
                self.source.header = {
                    content_type: await mimeLookup(header),
                };
            }
        }

        if (locked) {
            self.isLocked = locked;
        }

        if (bot) {
            self.isBot = bot;
        }

        if (discoverable) {
            self.isDiscoverable = discoverable;
        }

        const fieldEmojis: Emoji[] = [];

        if (fields_attributes) {
            self.fields = [];
            self.source.fields = [];
            for (const field of fields_attributes) {
                // Can be Markdown or plaintext, also has emojis
                const parsedName = await contentToHtml(
                    {
                        "text/markdown": {
                            content: field.name,
                            remote: false,
                        },
                    },
                    undefined,
                    true,
                );

                const parsedValue = await contentToHtml(
                    {
                        "text/markdown": {
                            content: field.value,
                            remote: false,
                        },
                    },
                    undefined,
                    true,
                );

                // Parse emojis
                const nameEmojis = await Emoji.parseFromText(parsedName);
                const valueEmojis = await Emoji.parseFromText(parsedValue);

                fieldEmojis.push(...nameEmojis, ...valueEmojis);

                // Replace fields
                self.fields.push({
                    key: {
                        "text/html": {
                            content: parsedName,
                            remote: false,
                        },
                    },
                    value: {
                        "text/html": {
                            content: parsedValue,
                            remote: false,
                        },
                    },
                });

                self.source.fields.push({
                    name: field.name,
                    value: field.value,
                });
            }
        }

        // Parse emojis
        const displaynameEmojis =
            await Emoji.parseFromText(sanitizedDisplayName);
        const noteEmojis = await Emoji.parseFromText(self.note);

        const emojis = mergeAndDeduplicate(
            displaynameEmojis,
            noteEmojis,
            fieldEmojis,
        );

        // Connect emojis, if any
        // Do it before updating user, so that federation takes that into account
        await user.updateEmojis(emojis);
        await user.update({
            displayName: self.displayName,
            username: self.username,
            note: self.note,
            avatar: self.avatar,
            header: self.header,
            fields: self.fields,
            isLocked: self.isLocked,
            isBot: self.isBot,
            isDiscoverable: self.isDiscoverable,
            source: self.source || undefined,
        });

        const output = await User.fromId(self.id);

        if (!output) {
            throw new ApiError(500, "Couldn't edit user");
        }

        return context.json(output.toApi(), 200);
    }),
);
