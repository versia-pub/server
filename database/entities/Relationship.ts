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
	/** The unique identifier for the relationship. */
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/** The user who owns the relationship. */
	@ManyToOne(() => User, user => user.relationships)
	owner!: User;

	/** The user who is the subject of the relationship. */
	@ManyToOne(() => User)
	subject!: User;

	/** Whether the owner is following the subject. */
	@Column("boolean")
	following!: boolean;

	/** Whether the owner is showing reblogs from the subject. */
	@Column("boolean")
	showing_reblogs!: boolean;

	/** Whether the owner is receiving notifications from the subject. */
	@Column("boolean")
	notifying!: boolean;

	/** Whether the owner is followed by the subject. */
	@Column("boolean")
	followed_by!: boolean;

	/** Whether the owner is blocking the subject. */
	@Column("boolean")
	blocking!: boolean;

	/** Whether the owner is blocked by the subject. */
	@Column("boolean")
	blocked_by!: boolean;

	/** Whether the owner is muting the subject. */
	@Column("boolean")
	muting!: boolean;

	/** Whether the owner is muting notifications from the subject. */
	@Column("boolean")
	muting_notifications!: boolean;

	/** Whether the owner has requested to follow the subject. */
	@Column("boolean")
	requested!: boolean;

	/** Whether the owner is blocking the subject's domain. */
	@Column("boolean")
	domain_blocking!: boolean;

	/** Whether the owner has endorsed the subject. */
	@Column("boolean")
	endorsed!: boolean;

	/** The languages the owner has specified for the subject. */
	@Column("jsonb")
	languages!: string[];

	/** A note the owner has added for the subject. */
	@Column("varchar")
	note!: string;

	/** The date the relationship was created. */
	@CreateDateColumn()
	created_at!: Date;

	/** The date the relationship was last updated. */
	@UpdateDateColumn()
	updated_at!: Date;

	/**
	 * Creates a new relationship between two users.
	 * @param owner The user who owns the relationship.
	 * @param other The user who is the subject of the relationship.
	 * @returns The newly created relationship.
	 */
	static async createNew(owner: User, other: User): Promise<Relationship> {
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

	/**
	 * Converts the relationship to an API-friendly format.
	 * @returns The API-friendly relationship.
	 */
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
