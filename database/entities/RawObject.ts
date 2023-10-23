import {
	BaseEntity,
	Column,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from "typeorm";
import { APImage, APObject, DateTime } from "activitypub-types";
import { ConfigType, getConfig } from "@config";
import { appendFile } from "fs/promises";
import { APIStatus } from "~types/entities/status";
import { RawActor } from "./RawActor";
import { APIAccount } from "~types/entities/account";
import { APIEmoji } from "~types/entities/emoji";
import { User } from "./User";
import { Status } from "./Status";

/**
 * Represents a raw ActivityPub object in the database.
 */
@Entity({
	name: "objects",
})
export class RawObject extends BaseEntity {
	/**
	 * The unique identifier of the object.
	 */
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/**
	 * The data associated with the object.
	 */
	@Column("jsonb")
	// Index ID, attributedTo, to and published for faster lookups
	@Index({ unique: true, where: "(data->>'id') IS NOT NULL" })
	@Index({ where: "(data->>'attributedTo') IS NOT NULL" })
	@Index({ where: "(data->>'to') IS NOT NULL" })
	@Index({ where: "(data->>'published') IS NOT NULL" })
	data!: APObject;

	/**
	 * Retrieves a RawObject instance by its ID.
	 * @param id The ID of the RawObject to retrieve.
	 * @returns A Promise that resolves to the RawObject instance, or undefined if not found.
	 */
	static async getById(id: string) {
		return await RawObject.createQueryBuilder("object")
			.where("object.data->>'id' = :id", {
				id,
			})
			.getOne();
	}

	/**
	 * Parses the emojis associated with the object.
	 * @returns A Promise that resolves to an array of APIEmoji objects.
	 */
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

	/**
	 * Converts the RawObject instance to an APIStatus object.
	 * @returns A Promise that resolves to the APIStatus object.
	 */
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
					await User.getByActorId(this.data.attributedTo as string)
				)?.toAPI()) ?? (null as unknown as APIAccount),
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

	/**
	 * Determines whether the object is filtered based on the note filters in the configuration.
	 * @returns A Promise that resolves to a boolean indicating whether the object is filtered.
	 */
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

	/**
	 * Determines whether a RawObject instance with the given ID exists in the database.
	 * @param id The ID of the RawObject to check for existence.
	 * @returns A Promise that resolves to a boolean indicating whether the RawObject exists.
	 */
	static async exists(id: string) {
		return !!(await RawObject.getById(id));
	}

	/**
	 * Creates a RawObject instance from a Status object.
	 * DOES NOT SAVE THE OBJECT TO THE DATABASE.
	 * @param status The Status object to create the RawObject from.
	 * @returns A Promise that resolves to the RawObject instance.
	 */
	static createFromStatus(status: Status, config: ConfigType) {
		const object = new RawObject();

		object.data = {
			id: `${config.http.base_url}/users/${status.account.username}/statuses/${status.id}`,
			type: "Note",
			summary: status.spoiler_text,
			content: status.content,
			inReplyTo: status.in_reply_to_post?.object.data.id,
			published: new Date().toISOString(),
			tag: [],
			attributedTo: `${config.http.base_url}/users/${status.account.username}`,
		};

		// Map status mentions to ActivityPub Actor IDs
		const mentionedUsers = status.mentions.map(
			user => user.actor.data.id as string
		);

		object.data.to = mentionedUsers;

		if (status.visibility === "private") {
			object.data.cc = [
				`${config.http.base_url}/users/${status.account.username}/followers`,
			];
		} else if (status.visibility === "direct") {
			// Add nothing else
		} else if (status.visibility === "public") {
			object.data.to = [
				...object.data.to,
				"https://www.w3.org/ns/activitystreams#Public",
			];
			object.data.cc = [
				`${config.http.base_url}/users/${status.account.username}/followers`,
			];
		}
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		else if (status.visibility === "unlisted") {
			object.data.to = [
				...object.data.to,
				"https://www.w3.org/ns/activitystreams#Public",
			];
		}

		return object;
	}
}
