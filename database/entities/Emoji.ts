import type { APIEmoji } from "~types/entities/emoji";
import type { Emoji as LysandEmoji } from "~types/lysand/extensions/org.lysand/custom_emojis";
import { client } from "~database/datasource";
import type { Emoji } from "@prisma/client";

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
				in: matches.map(match => match.replace(/:/g, "")),
			},
			instanceId: null,
		},
		include: {
			instance: true,
		},
	});
};

export const addEmojiIfNotExists = async (emoji: LysandEmoji) => {
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
			alt: emoji.alt || null,
			content_type: emoji.url[0].content_type,
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

export const emojiToLysand = (emoji: Emoji): LysandEmoji => {
	return {
		name: emoji.shortcode,
		url: [
			{
				content: emoji.url,
				content_type: emoji.content_type,
			},
		],
		alt: emoji.alt || undefined,
	};
};
