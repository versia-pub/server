import {
	BaseEntity,
	Column,
	Entity,
	IsNull,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { APIEmoji } from "~types/entities/emoji";
import { Instance } from "./Instance";
import { Emoji as LysandEmoji } from "~types/lysand/extensions/org.lysand/custom_emojis";

/**
 * Represents an emoji entity in the database.
 */
@Entity({
	name: "emojis",
})
export class Emoji extends BaseEntity {
	/**
	 * The unique identifier for the emoji.
	 */
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/**
	 * The shortcode for the emoji.
	 */
	@Column("varchar")
	shortcode!: string;

	/**
	 * The instance that the emoji is from.
	 * If is null, the emoji is from the server's instance
	 */
	@ManyToOne(() => Instance, {
		nullable: true,
	})
	instance!: Instance | null;

	/**
	 * The URL for the emoji.
	 */
	@Column("varchar")
	url!: string;

	/**
	 * The alt text for the emoji.
	 */
	@Column("varchar", {
		nullable: true,
	})
	alt!: string | null;

	/**
	 * The content type of the emoji.
	 */
	@Column("varchar")
	content_type!: string;

	/**
	 * Whether the emoji is visible in the picker.
	 */
	@Column("boolean")
	visible_in_picker!: boolean;

	/**
	 * Used for parsing emojis from local text
	 * @param text The text to parse
	 * @returns An array of emojis
	 */
	static async parseEmojis(text: string): Promise<Emoji[]> {
		const regex = /:[a-zA-Z0-9_]+:/g;
		const matches = text.match(regex);
		if (!matches) return [];
		return (
			await Promise.all(
				matches.map(match =>
					Emoji.findOne({
						where: {
							shortcode: match.slice(1, -1),
							instance: IsNull(),
						},
						relations: ["instance"],
					})
				)
			)
		).filter(emoji => emoji !== null) as Emoji[];
	}

	static async addIfNotExists(emoji: LysandEmoji) {
		const existingEmoji = await Emoji.findOne({
			where: {
				shortcode: emoji.name,
				instance: IsNull(),
			},
		});
		if (existingEmoji) return existingEmoji;
		const newEmoji = new Emoji();
		newEmoji.shortcode = emoji.name;
		// TODO: Content types
		newEmoji.url = emoji.url[0].content;
		newEmoji.alt = emoji.alt || null;
		newEmoji.content_type = emoji.url[0].content_type;
		newEmoji.visible_in_picker = true;
		await newEmoji.save();
		return newEmoji;
	}

	/**
	 * Converts the emoji to an APIEmoji object.
	 * @returns The APIEmoji object.
	 */
	// eslint-disable-next-line @typescript-eslint/require-await
	async toAPI(): Promise<APIEmoji> {
		return {
			shortcode: this.shortcode,
			static_url: this.url, // TODO: Add static version
			url: this.url,
			visible_in_picker: this.visible_in_picker,
			category: undefined,
		};
	}

	toLysand(): LysandEmoji {
		return {
			name: this.shortcode,
			url: [
				{
					content: this.url,
					content_type: this.content_type,
				},
			],
			alt: this.alt || undefined,
		};
	}
}
