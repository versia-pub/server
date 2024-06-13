import { applyConfig, auth, handleZodError, jsonOrForm } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { sanitizedHtmlStrip } from "@/sanitization";
import { zValidator } from "@hono/zod-validator";
import { config } from "config-manager";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import ISO6391 from "iso-639-1";
import { MediaBackend } from "media-manager";
import { z } from "zod";
import { getUrl } from "~/database/entities/attachment";
import { parseEmojis } from "~/database/entities/emoji";
import { contentToHtml } from "~/database/entities/status";
import { db } from "~/drizzle/db";
import { EmojiToUser, RolePermissions } from "~/drizzle/schema";
import type { Emoji } from "~/packages/database-interface/emoji";
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
    form: z.object({
        display_name: z
            .string()
            .min(3)
            .trim()
            .max(config.validation.max_displayname_size)
            .optional(),
        note: z
            .string()
            .min(0)
            .max(config.validation.max_bio_size)
            .trim()
            .optional(),
        avatar: z.instanceof(File).optional(),
        header: z.instanceof(File).optional(),
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
        zValidator("form", schemas.form, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user } = context.req.valid("header");
            const {
                display_name,
                note,
                avatar,
                header,
                locked,
                bot,
                discoverable,
                source,
                fields_attributes,
            } = context.req.valid("form");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            const self = user.data;

            const sanitizedDisplayName = await sanitizedHtmlStrip(
                display_name ?? "",
            );

            const mediaManager = await MediaBackend.fromBackendType(
                config.media.backend,
                config,
            );

            if (display_name) {
                // Check if display name doesnt match filters
                if (
                    config.filters.displayname.some((filter) =>
                        sanitizedDisplayName.match(filter),
                    )
                ) {
                    return errorResponse(
                        "Display name contains blocked words",
                        422,
                    );
                }

                self.displayName = sanitizedDisplayName;
            }

            if (note && self.source) {
                // Check if bio doesnt match filters
                if (config.filters.bio.some((filter) => note.match(filter))) {
                    return errorResponse("Bio contains blocked words", 422);
                }

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

            if (avatar) {
                // Check if within allowed avatar length (avatar is an image)
                if (avatar.size > config.validation.max_avatar_size) {
                    return errorResponse(
                        `Avatar must be less than ${config.validation.max_avatar_size} bytes`,
                        422,
                    );
                }

                const { path } = await mediaManager.addFile(avatar);

                self.avatar = getUrl(path, config);
            }

            if (header) {
                // Check if within allowed header length (header is an image)
                if (header.size > config.validation.max_header_size) {
                    return errorResponse(
                        `Header must be less than ${config.validation.max_avatar_size} bytes`,
                        422,
                    );
                }

                const { path } = await mediaManager.addFile(header);

                self.header = getUrl(path, config);
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
                    const nameEmojis = await parseEmojis(parsedName);
                    const valueEmojis = await parseEmojis(parsedValue);

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
            const displaynameEmojis = await parseEmojis(sanitizedDisplayName);
            const noteEmojis = await parseEmojis(self.note);

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
