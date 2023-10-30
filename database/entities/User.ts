import { ConfigType, getConfig } from "@config";
import {
	BaseEntity,
	Column,
	CreateDateColumn,
	Entity,
	JoinTable,
	ManyToMany,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	RemoveOptions,
	UpdateDateColumn,
} from "typeorm";
import { APIAccount } from "~types/entities/account";
import { Token } from "./Token";
import { Status, statusRelations } from "./Status";
import { APISource } from "~types/entities/source";
import { Relationship } from "./Relationship";
import { Instance } from "./Instance";

export const userRelations = ["relationships", "pinned_notes", "instance"];

/**
 * Represents a user in the database.
 * Stores local and remote users
 */
@Entity({
	name: "users",
})
export class User extends BaseEntity {
	/**
	 * The unique identifier for the user.
	 */
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/**
	 * The username for the user.
	 */
	@Column("varchar", {
		unique: true,
	})
	username!: string;

	/**
	 * The display name for the user.
	 */
	@Column("varchar")
	display_name!: string;

	/**
	 * The password for the user.
	 */
	@Column("varchar", {
		nullable: true,
	})
	password!: string | null;

	/**
	 * The email address for the user.
	 */
	@Column("varchar", {
		unique: true,
		nullable: true,
	})
	email!: string | null;

	/**
	 * The note for the user.
	 */
	@Column("varchar", {
		default: "",
	})
	note!: string;

	/**
	 * Whether the user is an admin or not.
	 */
	@Column("boolean", {
		default: false,
	})
	is_admin!: boolean;

	/**
	 * The source for the user.
	 */
	@Column("jsonb")
	source!: APISource;

	/**
	 * The avatar for the user (filename, as UUID)
	 */
	@Column("varchar")
	avatar!: string;

	/**
	 * The header for the user (filename, as UUID)
	 */
	@Column("varchar")
	header!: string;

	/**
	 * The date the user was created.
	 */
	@CreateDateColumn()
	created_at!: Date;

	/**
	 * The date the user was last updated.
	 */
	@UpdateDateColumn()
	updated_at!: Date;

	/**
	 * The public key for the user.
	 */
	@Column("varchar")
	public_key!: string;

	/**
	 * The private key for the user.
	 */
	@Column("varchar", {
		nullable: true,
	})
	private_key!: string | null;

	/**
	 * The relationships for the user.
	 */
	@OneToMany(() => Relationship, relationship => relationship.owner)
	relationships!: Relationship[];

	/**
	 * User's instance, null if local user
	 */
	@ManyToOne(() => Instance, {
		nullable: true,
	})
	instance!: Instance | null;

	/**
	 * The pinned notes for the user.
	 */
	@ManyToMany(() => Status, status => status.id)
	@JoinTable()
	pinned_notes!: Status[];

	/**
	 * Get the user's avatar in raw URL format
	 * @param config The config to use
	 * @returns The raw URL for the user's avatar
	 */
	getAvatarUrl(config: ConfigType) {
		if (config.media.backend === "local") {
			return `${config.http.base_url}/media/${this.avatar}`;
		} else if (config.media.backend === "s3") {
			return `${config.s3.public_url}/${this.avatar}`;
		}
	}

	/**
	 * Get the user's header in raw URL format
	 * @param config The config to use
	 * @returns The raw URL for the user's header
	 */
	getHeaderUrl(config: ConfigType) {
		if (config.media.backend === "local") {
			return `${config.http.base_url}/media/${this.header}`;
		} else if (config.media.backend === "s3") {
			return `${config.s3.public_url}/${this.header}`;
		}
	}

	static async getFromRequest(req: Request) {
		// Check auth token
		const token = req.headers.get("Authorization")?.split(" ")[1] || "";

		return { user: await User.retrieveFromToken(token), token };
	}

	/**
	 * Fetches the list of followers associated with the actor and updates the user's followers
	 */
	async fetchFollowers() {
		//
	}

	/**
	 * Gets a user by actor ID.
	 * @param id The actor ID to search for.
	 * @returns The user with the given actor ID.
	 */
	static async getByActorId(id: string) {
		return await User.createQueryBuilder("user")
			// Objects is a many-to-many relationship
			.leftJoinAndSelect("user.actor", "actor")
			.leftJoinAndSelect("user.relationships", "relationships")
			.where("actor.data @> :data", {
				data: JSON.stringify({
					id,
				}),
			})
			.getOne();
	}

	/**
	 * Creates a new LOCAL user.
	 * @param data The data for the new user.
	 * @returns The newly created user.
	 */
	static async createNewLocal(data: {
		username: string;
		display_name?: string;
		password: string;
		email: string;
		bio?: string;
		avatar?: string;
		header?: string;
	}) {
		const config = getConfig();
		const user = new User();

		user.username = data.username;
		user.display_name = data.display_name ?? data.username;
		user.password = await Bun.password.hash(data.password);
		user.email = data.email;
		user.note = data.bio ?? "";
		user.avatar = data.avatar ?? config.defaults.avatar;
		user.header = data.header ?? config.defaults.avatar;

		user.relationships = [];
		user.instance = null;

		user.source = {
			language: null,
			note: "",
			privacy: "public",
			sensitive: false,
			fields: [],
		};

		user.pinned_notes = [];

		await user.generateKeys();
		await user.save();

		return user;
	}

	/**
	 * Retrieves a user from a token.
	 * @param access_token The access token to retrieve the user from.
	 * @returns The user associated with the given access token.
	 */
	static async retrieveFromToken(access_token: string) {
		if (!access_token) return null;

		const token = await Token.findOne({
			where: {
				access_token,
			},
			relations: userRelations.map(r => `user.${r}`),
		});

		if (!token) return null;

		return token.user;
	}

	/**
	 * Gets the relationship to another user.
	 * @param other The other user to get the relationship to.
	 * @returns The relationship to the other user.
	 */
	async getRelationshipToOtherUser(other: User) {
		const relationship = await Relationship.findOne({
			where: {
				owner: {
					id: this.id,
				},
				subject: {
					id: other.id,
				},
			},
			relations: ["owner", "subject"],
		});

		return relationship;
	}

	/**
	 * Removes the user.
	 * @param options The options for removing the user.
	 * @returns The removed user.
	 */
	async remove(options?: RemoveOptions | undefined) {
		// Clean up tokens
		const tokens = await Token.findBy({
			user: {
				id: this.id,
			},
		});

		const statuses = await Status.find({
			where: {
				account: {
					id: this.id,
				},
			},
			relations: statusRelations,
		});

		// Delete both
		await Promise.all(tokens.map(async token => await token.remove()));

		await Promise.all(statuses.map(async status => await status.remove()));

		// Get relationships
		const relationships = await this.getRelationships();
		// Delete them all
		await Promise.all(
			relationships.map(async relationship => await relationship.remove())
		);

		return await super.remove(options);
	}

	/**
	 * Gets the relationships for the user.
	 * @returns The relationships for the user.
	 */
	async getRelationships() {
		const relationships = await Relationship.find({
			where: {
				owner: {
					id: this.id,
				},
			},
			relations: ["subject"],
		});

		return relationships;
	}

	/**
	 * Generates keys for the user.
	 */
	async generateKeys(): Promise<void> {
		// openssl genrsa -out private.pem 2048
		// openssl rsa -in private.pem -outform PEM -pubout -out public.pem

		const keys = await crypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				hash: "SHA-256",
				modulusLength: 4096,
				publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
			},
			true,
			["sign", "verify"]
		);

		const privateKey = btoa(
			String.fromCharCode.apply(null, [
				...new Uint8Array(
					// jesus help me what do these letters mean
					await crypto.subtle.exportKey("pkcs8", keys.privateKey)
				),
			])
		);
		const publicKey = btoa(
			String.fromCharCode(
				...new Uint8Array(
					// why is exporting a key so hard
					await crypto.subtle.exportKey("spki", keys.publicKey)
				)
			)
		);

		// Add header, footer and newlines later on
		// These keys are PEM encrypted
		this.private_key = privateKey;
		this.public_key = publicKey;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async toAPI(isOwnAccount = false): Promise<APIAccount> {
		const follower_count = await Relationship.count({
			where: {
				subject: {
					id: this.id,
				},
				following: true,
			},
			relations: ["subject"],
		});

		const following_count = await Relationship.count({
			where: {
				owner: {
					id: this.id,
				},
				following: true,
			},
			relations: ["owner"],
		});

		const statusCount = await Status.count({
			where: {
				account: {
					id: this.id,
				},
			},
			relations: ["account"],
		});

		const config = getConfig();

		return {
			id: this.id,
			username: this.username,
			display_name: this.display_name,
			note: this.note,
			url: `${config.http.base_url}/users/${this.username}`,
			avatar: this.getAvatarUrl(config) || config.defaults.avatar,
			header: this.getHeaderUrl(config) || config.defaults.header,
			locked: false,
			created_at: new Date(this.created_at).toISOString(),
			followers_count: follower_count,
			following_count: following_count,
			statuses_count: statusCount,
			emojis: [],
			fields: [],
			bot: false,
			source: isOwnAccount ? this.source : undefined,
			avatar_static: "",
			header_static: "",
			acct:
				this.instance === null
					? `${this.username}`
					: `${this.username}@${this.instance.base_url}`,
			limited: false,
			moved: null,
			noindex: false,
			suspended: false,
			discoverable: undefined,
			mute_expires_at: undefined,
			group: false,
			role: undefined,
		};
	}
}
