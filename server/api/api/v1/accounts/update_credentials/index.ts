import { apiRoute, applyConfig } from "@api";
import { convertTextToHtml } from "@formatting";
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
import { parseEmojis } from "~database/entities/Emoji";
import { findFirstUser, userToAPI } from "~database/entities/User";
import { db } from "~drizzle/db";
import { EmojiToUser, Users } from "~drizzle/schema";
import type { Source as APISource } from "~types/mastodon/source";

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
    "source[privacy]": z
        .enum(["public", "unlisted", "private", "direct"])
        .optional(),
    "source[sensitive]": z.boolean().optional(),
    "source[language]": z
        .enum(ISO6391.getAllCodes() as [string, ...string[]])
        .optional(),
});

export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { user: self } = extraData.auth;

        if (!self) return errorResponse("Unauthorized", 401);

        const config = await extraData.configManager.getConfig();

        const {
            display_name,
            note,
            avatar,
            header,
            locked,
            bot,
            discoverable,
            "source[privacy]": source_privacy,
            "source[sensitive]": source_sensitive,
            "source[language]": source_language,
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

            (self.source as APISource).note = sanitizedNote;
            self.note = await convertTextToHtml(sanitizedNote);
        }

        if (source_privacy && self.source) {
            (self.source as APISource).privacy = source_privacy;
        }

        if (source_sensitive && self.source) {
            (self.source as APISource).sensitive = source_sensitive;
        }

        if (source_language && self.source) {
            (self.source as APISource).language = source_language;
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

        // Parse emojis
        const displaynameEmojis = await parseEmojis(sanitizedDisplayName);
        const noteEmojis = await parseEmojis(sanitizedNote);

        self.emojis = [...displaynameEmojis, ...noteEmojis];

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

        const output = await findFirstUser({
            where: (user, { eq }) => eq(user.id, self.id),
        });

        if (!output) return errorResponse("Couldn't edit user", 500);

        return jsonResponse(userToAPI(output));
    },
);
