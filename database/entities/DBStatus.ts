import { getConfig } from "@config";
import {
	BaseEntity,
	Column,
	CreateDateColumn,
	Entity,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { Status } from "~types/entities/status";
import { DBUser } from "./DBUser";

const config = getConfig();

@Entity({
	name: "statuses",
})
export class DBStatus extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@ManyToOne(() => DBUser, (user) => user.id)
	account!: DBUser;

	@CreateDateColumn()
	created_at!: Date;

	@UpdateDateColumn()
	updated_at!: Date;

	@ManyToOne(() => DBStatus, (status) => status.id, {
		nullable: true,
	})
	reblog?: DBStatus;

	@Column("boolean")
	isReblog!: boolean;
	
	toAPI(): Status {
		return {
			account: this.account.toAPI(),
			application: null,
			bookmarked: false,
			created_at: this.created_at.toISOString(),
			emojis: [],
			favourited: false,
			favourites_count: 0,
			id: this.id,
			in_reply_to_account_id: null,
			in_reply_to_id: null,
			language: null,
			media_attachments: [],
			mentions: [],
			muted: false,
			pinned: false,
			poll: null,
			reblog: this.isReblog ? this.reblog?.toAPI() ?? null : null,
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
