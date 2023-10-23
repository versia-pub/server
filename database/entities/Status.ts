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
import { User, userRelations } from "./User";
import { Application } from "./Application";
import { Emoji } from "./Emoji";
import { RawActivity } from "./RawActivity";
import { RawObject } from "./RawObject";
import { Instance } from "./Instance";

const config = getConfig();

export const statusRelations = [
	"account",
	"reblog",
	"object",
	"in_reply_to_post",
	"instance",
	"in_reply_to_post.account",
	"application",
	"emojis",
	"mentions",
	"likes",
	"announces",
];

export const statusAndUserRelations = [
	...statusRelations,
	...[
		"account.actor",
		"account.relationships",
		"account.pinned_notes",
		"account.instance",
	],
];

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
		onDelete: "SET NULL",
	})
	reblog?: Status | null;

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
	@ManyToOne(() => Status, {
		nullable: true,
		onDelete: "SET NULL",
	})
	in_reply_to_post!: Status | null;

	/**
	 * The status' instance
	 */
	@ManyToOne(() => Instance, {
		nullable: true,
	})
	instance!: Instance | null;

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
	 * The users mentioned (excluding followers and such)
	 */
	@ManyToMany(() => User, user => user.id)
	@JoinTable()
	mentions!: User[];

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
	 * Returns whether this status is viewable by a user.
	 * @param user The user to check.
	 * @returns Whether this status is viewable by the user.
	 */
	isViewableByUser(user: User | null) {
		const relationship = user?.relationships.find(
			rel => rel.id === this.account.id
		);

		if (this.visibility === "public") return true;
		else if (this.visibility === "unlisted") return true;
		else if (this.visibility === "private") {
			return !!relationship?.following;
		} else {
			return user && this.mentions.includes(user);
		}
	}

	/**
	 * Return all the ancestors of this post,
	 */
	async getAncestors(fetcher: User | null) {
		const max = fetcher ? 4096 : 40;
		const ancestors = [];

		let id = this.in_reply_to_post?.id;

		while (ancestors.length < max && id) {
			const currentStatus = await Status.findOne({
				where: {
					id: id,
				},
				relations: statusRelations,
			});

			if (currentStatus) {
				if (currentStatus.isViewableByUser(fetcher)) {
					ancestors.push(currentStatus);
				}
				id = currentStatus.in_reply_to_post?.id;
			} else {
				break;
			}
		}

		return ancestors;
	}

	/**
	 * Return all the descendants of this post,
	 */
	async getDescendants(fetcher: User | null) {
		const max = fetcher ? 4096 : 60;
		// Go through all descendants in a tree-like manner
		const descendants: Status[] = [];

		return await Status._getDescendants(this, fetcher, max, descendants);
	}

	/**
	 * Return all the descendants of a post,
	 * @param status The status to get the descendants of.
	 * @param isAuthenticated Whether the user is authenticated.
	 * @param max The maximum number of descendants to get.
	 * @param descendants The descendants to add to.
	 * @returns A promise that resolves with the descendants.
	 * @private
	 */
	private static async _getDescendants(
		status: Status,
		fetcher: User | null,
		max: number,
		descendants: Status[]
	) {
		const currentStatus = await Status.find({
			where: {
				in_reply_to_post: {
					id: status.id,
				},
			},
			relations: statusRelations,
		});

		for (const status of currentStatus) {
			if (status.isViewableByUser(fetcher)) {
				descendants.push(status);
			}
			if (descendants.length < max) {
				await this._getDescendants(status, fetcher, max, descendants);
			}
		}

		return descendants;
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
			status: Status;
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
		newStatus.mentions = [];
		newStatus.instance = data.account.instance;

		if (data.reply) {
			newStatus.in_reply_to_post = data.reply.status;
		}
		// Get people mentioned in the content
		const mentionedPeople = [
			...data.content.matchAll(/@([a-zA-Z0-9_]+)/g),
		].map(match => {
			return `${config.http.base_url}/users/${match[1]}`;
		});

		// Get list of mentioned users
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
						relations: userRelations,
					});

					newStatus.mentions.push(user as User);
				} else {
					const user = await User.findOne({
						where: {
							username: person.split("@")[1],
						},
						relations: userRelations,
					});

					newStatus.mentions.push(user as User);
				}
			})
		);

		const object = RawObject.createFromStatus(newStatus, config);

		newStatus.object = object;
		await newStatus.object.save();
		await newStatus.save();
		return newStatus;
	}

	/**
	 * Converts this status to an API status.
	 * @returns A promise that resolves with the API status.
	 */
	async toAPI(): Promise<APIStatus> {
		const reblogCount = await Status.count({
			where: {
				reblog: {
					id: this.id,
				},
			},
			relations: ["reblog"],
		});

		const repliesCount = await Status.count({
			where: {
				in_reply_to_post: {
					id: this.id,
				},
			},
			relations: ["in_reply_to_post"],
		});

		return {
			id: this.id,
			in_reply_to_id: this.in_reply_to_post?.id || null,
			in_reply_to_account_id: this.in_reply_to_post?.account.id || null,
			account: await this.account.toAPI(),
			created_at: new Date(this.created_at).toISOString(),
			application: (await this.application?.toAPI()) || null,
			card: null,
			content: this.content,
			emojis: await Promise.all(this.emojis.map(emoji => emoji.toAPI())),
			favourited: false,
			favourites_count: 0,
			media_attachments: [],
			mentions: await Promise.all(
				this.mentions.map(async m => await m.toAPI())
			),
			language: null,
			muted: false,
			pinned: this.account.pinned_notes.some(note => note.id === this.id),
			poll: null,
			reblog: this.reblog ? await this.reblog.toAPI() : null,
			reblogged: !!this.reblog,
			reblogs_count: reblogCount,
			replies_count: repliesCount,
			sensitive: false,
			spoiler_text: "",
			tags: [],
			uri: `${config.http.base_url}/users/${this.account.username}/statuses/${this.id}`,
			visibility: "public",
			url: `${config.http.base_url}/users/${this.account.username}/statuses/${this.id}`,
			bookmarked: false,
			quote: null,
			quote_id: undefined,
		};
	}
}
