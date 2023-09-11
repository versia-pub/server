import { getConfig, getHost } from "@config";
import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Account } from "~types/entities/account";

const config = getConfig();

@Entity({
	name: "users",
})
export class User extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column("varchar", {
		unique: true,
	})
	username!: string;

	@Column("varchar")
	password!: string;

	@Column("varchar", {
		unique: true,
	})
	email!: string;

	@Column("varchar", {
		default: "",
	})
	bio!: string;

	@CreateDateColumn()
	created_at!: Date;

	@UpdateDateColumn()
	updated_at!: Date;

	toAccount(): Account {
		return {
			acct: `@${this.username}@${getHost()}`,
			avatar: "",
			avatar_static: "",
			bot: false,
			created_at: this.created_at.toISOString(),
			display_name: "",
			followers_count: 0,
			following_count: 0,
			group: false,
			header: "",
			header_static: "",
			id: this.id,
			locked: false,
			moved: null,
			noindex: false,
			note: this.bio,
			suspended: false,
			url: `${config.http.base_url}/@${this.username}`,
			username: this.username,
			emojis: [],
			fields: [],
			limited: false,
			source: undefined,
			statuses_count: 0,
			discoverable: undefined,
			role: undefined,
			mute_expires_at: undefined,
		}
	}
}