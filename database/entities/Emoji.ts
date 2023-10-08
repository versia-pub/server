import {
	BaseEntity,
	Column,
	Entity,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { APIEmoji } from "~types/entities/emoji";
import { Instance } from "./Instance";

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
			static_url: this.url, // TODO: Add static version
			url: this.url,
			visible_in_picker: this.visible_in_picker,
			category: undefined,
		};
	}
}
