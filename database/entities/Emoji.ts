import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { APIEmoji } from "~types/entities/emoji";

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
	 * The URL for the emoji.
	 */
	@Column("varchar")
	url!: string;

	/**
	 * Whether the emoji is visible in the picker.
	 */
	@Column("boolean")
	visible_in_picker!: boolean;

	/**
	 * Converts the emoji to an APIEmoji object.
	 * @returns The APIEmoji object.
	 */
	// eslint-disable-next-line @typescript-eslint/require-await
	async toAPI(): Promise<APIEmoji> {
		return {
			shortcode: this.shortcode,
			static_url: "",
			url: "",
			visible_in_picker: false,
			category: undefined,
		};
	}
}
