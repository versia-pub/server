import {
	BaseEntity,
	Column,
	CreateDateColumn,
	Entity,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { APIRelationship } from "~types/entities/relationship";

/**
 * Stores Mastodon API relationships
 */
@Entity({
	name: "relationships",
})
export class Relationship extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@ManyToOne(() => User, user => user.relationships)
	owner!: User;

	@ManyToOne(() => User)
	subject!: User;

	@Column("varchar")
	following!: boolean;

	@Column("varchar")
	showing_reblogs!: boolean;

	@Column("varchar")
	notifying!: boolean;

	@Column("varchar")
	followed_by!: boolean;

	@Column("varchar")
	blocking!: boolean;

	@Column("varchar")
	blocked_by!: boolean;

	@Column("varchar")
	muting!: boolean;

	@Column("varchar")
	muting_notifications!: boolean;

	@Column("varchar")
	requested!: boolean;

	@Column("varchar")
	domain_blocking!: boolean;

	@Column("varchar")
	endorsed!: boolean;

	@Column("jsonb")
	languages!: string[];

	@Column("varchar")
	note!: string;

	@CreateDateColumn()
	created_at!: Date;

	@UpdateDateColumn()
	updated_at!: Date;

	static async createNew(owner: User, other: User) {
		const newRela = new Relationship();
		newRela.owner = owner;
		newRela.subject = other;
		newRela.languages = [];
		newRela.following = false;
		newRela.showing_reblogs = false;
		newRela.notifying = false;
		newRela.followed_by = false;
		newRela.blocking = false;
		newRela.blocked_by = false;
		newRela.muting = false;
		newRela.muting_notifications = false;
		newRela.requested = false;
		newRela.domain_blocking = false;
		newRela.endorsed = false;
		newRela.note = "";

		await newRela.save();

		return newRela;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async toAPI(): Promise<APIRelationship> {
		return {
			blocked_by: this.blocked_by,
			blocking: this.blocking,
			domain_blocking: this.domain_blocking,
			endorsed: this.endorsed,
			followed_by: this.followed_by,
			following: this.following,
			id: this.subject.id,
			muting: this.muting,
			muting_notifications: this.muting_notifications,
			notifying: this.notifying,
			requested: this.requested,
			showing_reblogs: this.showing_reblogs,
			languages: this.languages,
			note: this.note,
		};
	}
}
