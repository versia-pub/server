import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { APActor, APObject, DateTime } from "activitypub-types";
import { getConfig } from "@config";
import { appendFile } from "fs/promises";
import { APIStatus } from "~types/entities/status";
import { RawActor } from "./RawActor";
import { APIAccount } from "~types/entities/account";
import { User } from "./User";

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

	async isPinned() {
		
	}

	async toAPI(): Promise<APIStatus> {
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
			emojis: [],
			favourited: false,
			favourites_count: 0,
			media_attachments: [],
			mentions: [],
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
