import { getConfig } from "@config";
import {
	BaseEntity,
	Column,
	CreateDateColumn,
	Entity,
	JoinTable,
	ManyToMany,
	ManyToOne,
	PrimaryGeneratedColumn,
	RemoveOptions,
	UpdateDateColumn,
} from "typeorm";
import { APIStatus } from "~types/entities/status";
import { User } from "./User";
import { Application } from "./Application";
import { Emoji } from "./Emoji";
import { RawActivity } from "./RawActivity";
import { RawObject } from "./RawObject";

const config = getConfig();

/**
 * Represents a status (i.e. a post)
 */
@Entity({
	name: "statuses",
})
export class Status extends BaseEntity {
	/**
	 * The unique identifier for this status.
	 */
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/**
	 * The user account that created this status.
	 */
	@ManyToOne(() => User, user => user.id)
	account!: User;

	/**
	 * The date and time when this status was created.
	 */
	@CreateDateColumn()
	created_at!: Date;

	/**
	 * The date and time when this status was last updated.
	 */
	@UpdateDateColumn()
	updated_at!: Date;

	/**
	 * The status that this status is a reblog of, if any.
	 */
	@ManyToOne(() => Status, status => status.id, {
		nullable: true,
	})
	reblog?: Status;

	/**
	 * The raw object associated with this status.
	 */
	@ManyToOne(() => RawObject, {
		nullable: true,
		onDelete: "SET NULL",
	})
	object!: RawObject;

	/**
	 * Whether this status is a reblog.
	 */
	@Column("boolean")
	isReblog!: boolean;

	/**
	 * The content of this status.
	 */
	@Column("varchar", {
		default: "",
	})
	content!: string;

	/**
	 * The visibility of this status.
	 */
	@Column("varchar")
	visibility!: APIStatus["visibility"];

	/**
	 * The raw object that this status is a reply to, if any.
	 */
	@ManyToOne(() => RawObject, {
		nullable: true,
	})
	in_reply_to_post!: RawObject | null;

	/**
	 * The raw actor that this status is a reply to, if any.
	 */
	@ManyToOne(() => User, {
		nullable: true,
	})
	in_reply_to_account!: User | null;

	/**
	 * Whether this status is sensitive.
	 */
	@Column("boolean")
	sensitive!: boolean;

	/**
	 * The spoiler text for this status.
	 */
	@Column("varchar", {
		default: "",
	})
	spoiler_text!: string;

	/**
	 * The application associated with this status, if any.
	 */
	@ManyToOne(() => Application, app => app.id, {
		nullable: true,
	})
	application!: Application | null;

	/**
	 * The emojis associated with this status.
	 */
	@ManyToMany(() => Emoji, emoji => emoji.id)
	@JoinTable()
	emojis!: Emoji[];

	/**
	 * The activities that have liked this status.
	 */
	@ManyToMany(() => RawActivity, activity => activity.id)
	@JoinTable()
	likes!: RawActivity[];

	/**
	 * The activities that have announced this status.
	 */
	@ManyToMany(() => RawActivity, activity => activity.id)
	@JoinTable()
	announces!: RawActivity[];

	/**
	 * Removes this status from the database.
	 * @param options The options for removing this status.
	 * @returns A promise that resolves when the status has been removed.
	 */
	async remove(options?: RemoveOptions | undefined) {
		// Delete object
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (this.object) await this.object.remove(options);

		return await super.remove(options);
	}

	async parseEmojis(string: string) {
		const emojis = [...string.matchAll(/:([a-zA-Z0-9_]+):/g)].map(
			match => match[1]
		);

		const emojiObjects = await Promise.all(
			emojis.map(async emoji => {
				const emojiObject = await Emoji.findOne({
					where: {
						shortcode: emoji,
					},
				});

				return emojiObject;
			})
		);

		return emojiObjects.filter(emoji => emoji !== null) as Emoji[];
	}

	/**
	 * Creates a new status and saves it to the database.
	 * @param data The data for the new status.
	 * @returns A promise that resolves with the new status.
	 */
	static async createNew(data: {
		account: User;
		application: Application | null;
		content: string;
		visibility: APIStatus["visibility"];
		sensitive: boolean;
		spoiler_text: string;
		emojis: Emoji[];
		reply?: {
			object: RawObject;
			user: User;
		};
	}) {
		const newStatus = new Status();

		newStatus.account = data.account;
		newStatus.application = data.application ?? null;
		newStatus.content = data.content;
		newStatus.visibility = data.visibility;
		newStatus.sensitive = data.sensitive;
		newStatus.spoiler_text = data.spoiler_text;
		newStatus.emojis = data.emojis;
		newStatus.likes = [];
		newStatus.announces = [];
		newStatus.isReblog = false;
		newStatus.announces = [];

		newStatus.object = new RawObject();

		if (data.reply) {
			newStatus.in_reply_to_post = data.reply.object;
			newStatus.in_reply_to_account = data.reply.user;
		}

		newStatus.object.data = {
			id: `${config.http.base_url}/@${data.account.username}/statuses/${newStatus.id}`,
			type: "Note",
			summary: data.spoiler_text,
			content: data.content, // TODO: Format as HTML
			inReplyTo: data.reply?.object
				? data.reply.object.data.id
				: undefined,
			published: new Date().toISOString(),
			tag: [],
			attributedTo: `${config.http.base_url}/@${data.account.username}`,
		};

		// Get people mentioned in the content
		const mentionedPeople = [
			...data.content.matchAll(/@([a-zA-Z0-9_]+)/g),
		].map(match => {
			return `${config.http.base_url}/@${match[1]}`;
		});

		// Map this to Users
		const mentionedUsers = (
			await Promise.all(
				mentionedPeople.map(async person => {
					// Check if post is in format @username or @username@instance.com
					// If is @username, the user is a local user
					const instanceUrl =
						person.split("@").length === 3
							? person.split("@")[2]
							: null;

					if (instanceUrl) {
						const user = await User.findOne({
							where: {
								username: person.split("@")[1],
								// If contains instanceUrl
								instance: {
									base_url: instanceUrl,
								},
							},
							relations: {
								actor: true,
								instance: true,
							},
						});

						return user?.actor.data.id;
					} else {
						const user = await User.findOne({
							where: {
								username: person.split("@")[1],
							},
							relations: {
								actor: true,
							},
						});

						return user?.actor.data.id;
					}
				})
			)
		).map(user => user as string);

		newStatus.object.data.to = mentionedUsers;

		if (data.visibility === "private") {
			newStatus.object.data.cc = [
				`${config.http.base_url}/@${data.account.username}/followers`,
			];
		} else if (data.visibility === "direct") {
			// Add nothing else
		} else if (data.visibility === "public") {
			newStatus.object.data.to = [
				...newStatus.object.data.to,
				"https://www.w3.org/ns/activitystreams#Public",
			];
			newStatus.object.data.cc = [
				`${config.http.base_url}/@${data.account.username}/followers`,
			];
		}
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		else if (data.visibility === "unlisted") {
			newStatus.object.data.to = [
				...newStatus.object.data.to,
				"https://www.w3.org/ns/activitystreams#Public",
			];
		}

		// TODO: Add default language
		await newStatus.object.save();
		await newStatus.save();
		return newStatus;
	}

	/**
	 * Converts this status to an API status.
	 * @returns A promise that resolves with the API status.
	 */
	async toAPI(): Promise<APIStatus> {
		return await this.object.toAPI();
	}
}
