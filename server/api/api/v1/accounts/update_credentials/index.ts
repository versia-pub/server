import { applyConfig, auth, handleZodError, jsonOrForm } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { sanitizedHtmlStrip } from "@/sanitization";
import type { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull } from "drizzle-orm";
import ISO6391 from "iso-639-1";
import { z } from "zod";
import { contentToHtml } from "~/classes/functions/status";
import { MediaManager } from "~/classes/media/media-manager";
import { db } from "~/drizzle/db";
import { EmojiToUser, RolePermissions, Users } from "~/drizzle/schema";
import { config } from "~/packages/config-manager/index";
import { Attachment } from "~/packages/database-interface/attachment";
import { Emoji } from "~/packages/database-interface/emoji";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["PATCH"],
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
            .instanceof(File)
            .refine(
                (v) => v.size <= config.validation.max_avatar_size,
                `Avatar must be less than ${config.validation.max_avatar_size} bytes`,
            )
            .optional(),
        header: z
            .instanceof(File)
            .refine(
                (v) => v.size <= config.validation.max_header_size,
                `Header must be less than ${config.validation.max_header_size} bytes`,
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

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        jsonOrForm(),
        zValidator("json", schemas.json, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user } = context.req.valid("header");
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
                return errorResponse("Unauthorized", 401);
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
                    return errorResponse("Username is already taken", 400);
                }

                self.username = username;
            }

            if (avatar) {
                const { path } = await mediaManager.addFile(avatar);

                self.avatar = Attachment.getUrl(path);
            }

            if (header) {
                const { path } = await mediaManager.addFile(header);

                self.header = Attachment.getUrl(path);
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
                            },
                        },
                        undefined,
                        true,
                    );

                    const parsedValue = await contentToHtml(
                        {
                            "text/markdown": {
                                content: field.value,
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
                            },
                        },
                        value: {
                            "text/html": {
                                content: parsedValue,
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

            self.emojis = [
                ...displaynameEmojis,
                ...noteEmojis,
                ...fieldEmojis,
            ].map((e) => e.data);

            // Deduplicate emojis
            self.emojis = self.emojis.filter(
                (emoji, index, self) =>
                    self.findIndex((e) => e.id === emoji.id) === index,
            );

            // Connect emojis, if any
            // Do it before updating user, so that federation takes that into account
            for (const emoji of self.emojis) {
                await db
                    .delete(EmojiToUser)
                    .where(
                        and(
                            eq(EmojiToUser.emojiId, emoji.id),
                            eq(EmojiToUser.userId, self.id),
                        ),
                    )
                    .execute();

                await db
                    .insert(EmojiToUser)
                    .values({
                        emojiId: emoji.id,
                        userId: self.id,
                    })
                    .execute();
            }

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
                return errorResponse("Couldn't edit user", 500);
            }

            return jsonResponse(output.toApi());
        },
    );
