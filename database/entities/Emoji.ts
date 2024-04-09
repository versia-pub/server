import type { Emoji } from "@prisma/client";
import { client } from "~database/datasource";
import type { APIEmoji } from "~types/entities/emoji";
import type * as Lysand from "lysand-types";

/**
 * Represents an emoji entity in the database.
 */

/**
 * Used for parsing emojis from local text
 * @param text The text to parse
 * @returns An array of emojis
 */
export const parseEmojis = async (text: string): Promise<Emoji[]> => {
    const regex = /:[a-zA-Z0-9_]+:/g;
    const matches = text.match(regex);
    if (!matches) return [];
    return await client.emoji.findMany({
        where: {
            shortcode: {
                in: matches.map((match) => match.replace(/:/g, "")),
            },
            instanceId: null,
        },
        include: {
            instance: true,
        },
    });
};

export const addEmojiIfNotExists = async (emoji: Lysand.Emoji) => {
    const existingEmoji = await client.emoji.findFirst({
        where: {
            shortcode: emoji.name,
            instance: null,
        },
    });

    if (existingEmoji) return existingEmoji;

    return await client.emoji.create({
        data: {
            shortcode: emoji.name,
            url: emoji.url[0].content,
            alt: emoji.alt || emoji.url[0].description || undefined,
            content_type: Object.keys(emoji.url)[0],
            visible_in_picker: true,
        },
    });
};

/**
 * Converts the emoji to an APIEmoji object.
 * @returns The APIEmoji object.
 */
export const emojiToAPI = (emoji: Emoji): APIEmoji => {
    return {
        shortcode: emoji.shortcode,
        static_url: emoji.url, // TODO: Add static version
        url: emoji.url,
        visible_in_picker: emoji.visible_in_picker,
        category: undefined,
    };
};

export const emojiToLysand = (emoji: Emoji): Lysand.Emoji => {
    return {
        name: emoji.shortcode,
        url: {
            [emoji.content_type]: {
                content: emoji.url,
                description: emoji.alt || undefined,
            },
        },
        alt: emoji.alt || undefined,
    };
};
