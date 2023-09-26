import { getConfig } from "@config";
import {
	BaseEntity,
	Column,
	CreateDateColumn,
	Entity,
	JoinTable,
	ManyToMany,
	ManyToOne,
	OneToOne,
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
import { RawActor } from "./RawActor";

const config = getConfig();

/**
 * Stores ActivityPub notes
 */
@Entity({
	name: "statuses",
})
export class Status extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@ManyToOne(() => User, user => user.id)
	account!: User;

	@CreateDateColumn()
	created_at!: Date;

	@UpdateDateColumn()
	updated_at!: Date;

	@ManyToOne(() => Status, status => status.id, {
		nullable: true,
	})
	reblog?: Status;

	@OneToOne(() => Status)
	object!: RawObject;

	@Column("boolean")
	isReblog!: boolean;

	@Column("varchar", {
		default: "",
	})
	content!: string;

	@Column("varchar")
	visibility!: APIStatus["visibility"];

	@ManyToOne(() => RawObject, {
		nullable: true,
	})
	in_reply_to_post!: RawObject;

	@ManyToOne(() => RawActor, {
		nullable: true,
	})
	in_reply_to_account!: RawActor;

	@Column("boolean")
	sensitive!: boolean;

	@Column("varchar", {
		default: "",
	})
	spoiler_text!: string;

	@ManyToOne(() => Application, app => app.id, {
		nullable: true,
	})
	application!: Application | null;

	@ManyToMany(() => Emoji, emoji => emoji.id)
	@JoinTable()
	emojis!: Emoji[];

	@ManyToMany(() => RawActivity, activity => activity.id)
	@JoinTable()
	likes!: RawActivity[];

	@ManyToMany(() => RawActivity, activity => activity.id)
	@JoinTable()
	announces!: RawActivity[];

	async remove(options?: RemoveOptions | undefined) {
		// Delete object
		await this.object.remove(options);

		await super.remove(options);

		return this;
	}

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
			actor: RawActor;
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
			newStatus.in_reply_to_account = data.reply.actor;
		}

		newStatus.object.data = {
			id: `${config.http.base_url}/@${data.account.username}/statuses/${newStatus.id}`,
			type: "Note",
			summary: data.spoiler_text,
			content: data.content, // TODO: Format as HTML
			inReplyTo: data.reply?.object
				? data.reply.object.data.id
				: undefined,
			attributedTo: `${config.http.base_url}/@${data.account.username}`,
		};

		// Get people mentioned in the content
		const mentionedPeople = [
			...data.content.matchAll(/@([a-zA-Z0-9_]+)/g),
		].map(match => {
			return `${config.http.base_url}/@${match[1]}`;
		});

		// Map this to Actors
		const mentionedActors = (
			await Promise.all(
				mentionedPeople.map(async person => {
					// Check if post is in format @username or @username@instance.com
					// If is @username, the user is a local user
					const instanceUrl =
						person.split("@").length === 3
							? person.split("@")[2]
							: null;

					if (instanceUrl) {
						const actor = await RawActor.createQueryBuilder("actor")
							.where("actor.data->>'id' = :id", {
								// Where ID contains the instance URL
								id: `%${instanceUrl}%`,
							})
							// Where actor preferredUsername is the username
							.andWhere(
								"actor.data->>'preferredUsername' = :username",
								{
									username: person.split("@")[1],
								}
							)
							.getOne();

						return actor?.data.id;
					} else {
						const actor = await User.findOne({
							where: {
								username: person.split("@")[1],
							},
							relations: {
								actor: true,
							},
						});

						return actor?.actor.data.id;
					}
				})
			)
		).map(actor => actor as string);

		newStatus.object.data.to = mentionedActors;

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

		await newStatus.save();
		return newStatus;
	}

	async toAPI(): Promise<APIStatus> {
		return {
			account: await this.account.toAPI(),
			application: (await this.application?.toAPI()) ?? null,
			bookmarked: false,
			created_at: this.created_at.toISOString(),
			emojis: await Promise.all(
				this.emojis.map(async emoji => await emoji.toAPI())
			),
			favourited: false,
			favourites_count: this.likes.length,
			id: this.id,
			in_reply_to_account_id: null,
			in_reply_to_id: null,
			language: null,
			media_attachments: [],
			mentions: [],
			muted: false,
			pinned: false,
			poll: null,
			reblog: this.isReblog ? (await this.reblog?.toAPI()) ?? null : null,
			reblogged: false,
			reblogs_count: this.announces.length,
			replies_count: 0,
			sensitive: false,
			spoiler_text: "",
			tags: [],
			card: null,
			content: this.content,
			uri: `${config.http.base_url}/@${this.account.username}/${this.id}`,
			url: `${config.http.base_url}/@${this.account.username}/${this.id}`,
			visibility: "public",
			quote: null,
		};
	}
}
