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
	UpdateDateColumn,
} from "typeorm";
import { APIStatus } from "~types/entities/status";
import { User } from "./User";
import { Application } from "./Application";
import { Emoji } from "./Emoji";
import { RawActivity } from "./RawActivity";

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

	@Column("boolean")
	isReblog!: boolean;

	@Column("varchar", {
		default: "",
	})
	content!: string;

	@Column("varchar")
	visibility!: APIStatus["visibility"];

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

	static async createNew(data: {
		account: User;
		application: Application | null;
		content: string;
		visibility: APIStatus["visibility"];
		sensitive: boolean;
		spoiler_text: string;
		emojis: Emoji[];
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
