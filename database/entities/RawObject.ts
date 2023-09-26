import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { APActor, APImage, APObject, DateTime } from "activitypub-types";
import { getConfig } from "@config";
import { appendFile } from "fs/promises";
import { APIStatus } from "~types/entities/status";
import { RawActor } from "./RawActor";
import { APIAccount } from "~types/entities/account";
import { APIEmoji } from "~types/entities/emoji";

/**
 * Stores an ActivityPub object as raw JSON-LD data
 */
@Entity({
	name: "objects",
})
export class RawObject extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column("jsonb")
	data!: APObject;

	static async getById(id: string) {
		return await RawObject.createQueryBuilder("object")
			.where("object.data->>'id' = :id", {
				id,
			})
			.getOne();
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async parseEmojis() {
		const emojis = this.data.tag as {
			id: string;
			type: string;
			name: string;
			updated: string;
			icon: {
				type: "Image";
				mediaType: string;
				url: string;
			};
		}[];

		return emojis.map(emoji => ({
			shortcode: emoji.name,
			static_url: (emoji.icon as APImage).url,
			url: (emoji.icon as APImage).url,
			visible_in_picker: true,
			category: "custom",
		})) as APIEmoji[];
	}

	async toAPI(): Promise<APIStatus> {
		const mentions = (
			await Promise.all(
				(this.data.to as string[]).map(
					async person => await RawActor.getByActorId(person)
				)
			)
		).filter(m => m) as RawActor[];

		return {
			account:
				(await (
					await RawActor.getByActorId(
						(this.data.attributedTo as APActor).id ?? ""
					)
				)?.toAPIAccount()) ?? (null as unknown as APIAccount),
			created_at: new Date(this.data.published as DateTime).toISOString(),
			id: this.id,
			in_reply_to_id: null,
			application: null,
			card: null,
			content: this.data.content as string,
			emojis: await this.parseEmojis(),
			favourited: false,
			favourites_count: 0,
			media_attachments: [],
			mentions: await Promise.all(
				mentions.map(async m => await m.toAPIAccount())
			),
			in_reply_to_account_id: null,
			language: null,
			muted: false,
			pinned: false,
			poll: null,
			reblog: null,
			reblogged: false,
			reblogs_count: 0,
			replies_count: 0,
			sensitive: false,
			spoiler_text: "",
			tags: [],
			uri: this.data.id as string,
			visibility: "public",
			url: this.data.id as string,
			bookmarked: false,
			quote: null,
			quote_id: undefined,
		};
	}

	async isObjectFiltered() {
		const config = getConfig();

		const filter_result = await Promise.all(
			config.filters.note_filters.map(async filter => {
				if (
					this.data.type === "Note" &&
					this.data.content?.match(filter)
				) {
					// Log filter

					if (config.logging.log_filters)
						await appendFile(
							process.cwd() + "/logs/filters.log",
							`${new Date().toISOString()} Filtered note content: "${this.data.content.replaceAll(
								"\n",
								" "
							)}" (ID: ${
								this.data.id
							}) based on rule: ${filter}\n`
						);
					return true;
				}
			})
		);

		return filter_result.includes(true);
	}

	static async exists(id: string) {
		return !!(await RawObject.getById(id));
	}
}
