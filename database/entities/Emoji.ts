import { type InferSelectModel, and, eq } from "drizzle-orm";
import type * as Lysand from "lysand-types";
import { db } from "~drizzle/db";
import { Emojis, Instances } from "~drizzle/schema";
import type { Emoji as APIEmoji } from "~types/mastodon/emoji";
import { addInstanceIfNotExists } from "./Instance";

export type EmojiWithInstance = InferSelectModel<typeof Emojis> & {
    instance: InferSelectModel<typeof Instances> | null;
};

/**
 * Used for parsing emojis from local text
 * @param text The text to parse
 * @returns An array of emojis
 */
export const parseEmojis = async (text: string) => {
    const regex = /:[a-zA-Z0-9_]+:/g;
    const matches = text.match(regex);
    if (!matches) return [];
    const emojis = await db.query.Emojis.findMany({
        where: (emoji, { eq, or }) =>
            or(
                ...matches
                    .map((match) => match.replace(/:/g, ""))
                    .map((match) => eq(emoji.shortcode, match)),
            ),
        with: {
            instance: true,
        },
    });

    return emojis;
};

/**
 * Gets an emoji from the database, and fetches it from the remote instance if it doesn't exist.
 * @param emoji Emoji to fetch
 * @param host Host to fetch the emoji from if remote
 * @returns The emoji
 */
export const fetchEmoji = async (
    emojiToFetch: Lysand.Emoji,
    host?: string,
): Promise<EmojiWithInstance> => {
    const existingEmoji = await db
        .select()
        .from(Emojis)
        .innerJoin(Instances, eq(Emojis.instanceId, Instances.id))
        .where(
            and(
                eq(Emojis.shortcode, emojiToFetch.name),
                host ? eq(Instances.baseUrl, host) : undefined,
            ),
        )
        .limit(1);

    if (existingEmoji[0])
        return {
            ...existingEmoji[0].Emojis,
            instance: existingEmoji[0].Instances,
        };

    const foundInstance = host ? await addInstanceIfNotExists(host) : null;

    const result = (
        await db
            .insert(Emojis)
            .values({
                shortcode: emojiToFetch.name,
                url: Object.entries(emojiToFetch.url)[0][1].content,
                alt:
                    emojiToFetch.alt ||
                    Object.entries(emojiToFetch.url)[0][1].description ||
                    undefined,
                contentType: Object.keys(emojiToFetch.url)[0],
                visibleInPicker: true,
                instanceId: foundInstance?.id,
            })
            .returning()
    )[0];

    return {
        ...result,
        instance: foundInstance,
    };
};

/**
 * Converts the emoji to an APIEmoji object.
 * @returns The APIEmoji object.
 */
export const emojiToAPI = (emoji: EmojiWithInstance): APIEmoji => {
    return {
        shortcode: emoji.shortcode,
        static_url: emoji.url, // TODO: Add static version
        url: emoji.url,
        visible_in_picker: emoji.visibleInPicker,
        category: undefined,
    };
};

export const emojiToLysand = (emoji: EmojiWithInstance): Lysand.Emoji => {
    return {
        name: emoji.shortcode,
        url: {
            [emoji.contentType]: {
                content: emoji.url,
                description: emoji.alt || undefined,
            },
        },
        alt: emoji.alt || undefined,
    };
};
