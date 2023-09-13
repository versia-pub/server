import { getConfig } from "@config";
import {
	BaseEntity,
	Column,
	CreateDateColumn,
	Entity,
	ManyToMany,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { APIStatus } from "~types/entities/status";
import { User } from "./User";
import { Application } from "./Application";
import { Emoji } from "./Emoji";
import { Favourite } from "./Favourite";
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
	emojis!: Emoji[];

	@ManyToMany(() => RawActivity, activity => activity.id, {})
	likes: RawActivity[] = [];

	@ManyToMany(() => RawActivity, activity => activity.id, {})
	announces: RawActivity[] = [];

	async getFavourites(): Promise<Favourite[]> {
		return Favourite.find({
			where: {
				object: {
					id: this.id,
				},
			},
		});
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
			favourites_count: (await this.getFavourites()).length,
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
			reblogs_count: 0,
			replies_count: 0,
			sensitive: false,
			spoiler_text: "",
			tags: [],
			card: null,
			content: "",
			uri: `${config.http.base_url}/@${this.account.username}/${this.id}`,
			url: `${config.http.base_url}/@${this.account.username}/${this.id}`,
			visibility: "public",
			quote: null,
		};
	}
}
