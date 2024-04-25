import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { sanitizeHtml } from "@sanitization";
import { config } from "config-manager";
import { and, eq } from "drizzle-orm";
import ISO6391 from "iso-639-1";
import { MediaBackendType } from "media-manager";
import type { MediaBackend } from "media-manager";
import { LocalMediaBackend, S3MediaBackend } from "media-manager";
import { z } from "zod";
import { getUrl } from "~database/entities/Attachment";
import { parseEmojis, type EmojiWithInstance } from "~database/entities/Emoji";
import { contentToHtml } from "~database/entities/Status";
import { db } from "~drizzle/db";
import { EmojiToUser, Users } from "~drizzle/schema";
import { User } from "~packages/database-interface/user";

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
});

export const schema = z.object({
    display_name: z
        .string()
        .min(3)
        .max(config.validation.max_displayname_size)
        .optional(),
    note: z.string().min(0).max(config.validation.max_bio_size).optional(),
    avatar: z.instanceof(File).optional(),
    header: z.instanceof(File).optional(),
    locked: z.boolean().optional(),
    bot: z.boolean().optional(),
    discoverable: z.boolean().optional(),
    source: z
        .object({
            privacy: z
                .enum(["public", "unlisted", "private", "direct"])
                .optional(),
            sensitive: z.boolean().optional(),
            language: z
                .enum(ISO6391.getAllCodes() as [string, ...string[]])
                .optional(),
        })
        .optional(),
    fields_attributes: z
        .array(
            z.object({
                name: z.string().max(config.validation.max_field_name_size),
                value: z.string().max(config.validation.max_field_value_size),
            }),
        )
        .max(config.validation.max_field_count)
        .optional(),
});

export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { user } = extraData.auth;

        if (!user) return errorResponse("Unauthorized", 401);

        const config = await extraData.configManager.getConfig();
        const self = user.getUser();

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
        } = extraData.parsedRequest;

        const sanitizedNote = await sanitizeHtml(note ?? "");

        const sanitizedDisplayName = display_name ?? ""; /*  sanitize(display_name ?? "", {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
    });
 */
        /* if (!user.source) {
		user.source = {
			privacy: "public",
			sensitive: false,
			language: "en",
			note: "",
		};
	} */

        let mediaManager: MediaBackend;

        switch (config.media.backend as MediaBackendType) {
            case MediaBackendType.LOCAL:
                mediaManager = new LocalMediaBackend(config);
                break;
            case MediaBackendType.S3:
                mediaManager = new S3MediaBackend(config);
                break;
            default:
                // TODO: Replace with logger
                throw new Error("Invalid media backend");
        }

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
            if (
                config.filters.bio.some((filter) => sanitizedNote.match(filter))
            ) {
                return errorResponse("Bio contains blocked words", 422);
            }

            self.source.note = sanitizedNote;
            self.note = await contentToHtml({
                "text/markdown": {
                    content: sanitizedNote,
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

        const fieldEmojis: EmojiWithInstance[] = [];

        if (fields_attributes) {
            self.fields = [];
            self.source.fields = [];
            for (const field of fields_attributes) {
                // Can be Markdown or plaintext, also has emojis
                const parsedName = await contentToHtml({
                    "text/markdown": {
                        content: field.name,
                    },
                });

                const parsedValue = await contentToHtml({
                    "text/markdown": {
                        content: field.value,
                    },
                });

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
        const noteEmojis = await parseEmojis(sanitizedNote);

        self.emojis = [...displaynameEmojis, ...noteEmojis, ...fieldEmojis];

        // Deduplicate emojis
        self.emojis = self.emojis.filter(
            (emoji, index, self) =>
                self.findIndex((e) => e.id === emoji.id) === index,
        );

        await db
            .update(Users)
            .set({
                displayName: self.displayName,
                note: self.note,
                avatar: self.avatar,
                header: self.header,
                fields: self.fields,
                isLocked: self.isLocked,
                isBot: self.isBot,
                isDiscoverable: self.isDiscoverable,
                source: self.source || undefined,
            })
            .where(eq(Users.id, self.id));

        // Connect emojis, if any
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

        const output = await User.fromId(self.id);
        if (!output) return errorResponse("Couldn't edit user", 500);

        return jsonResponse(output.toAPI());
    },
);
