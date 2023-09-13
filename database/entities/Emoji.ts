import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { APIEmoji } from "~types/entities/emoji";

@Entity({
	name: "emojis",
})
export class Emoji extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column("varchar")
	shortcode!: string;

	@Column("varchar")
	url!: string;

	@Column("boolean")
	visible_in_picker!: boolean;

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
