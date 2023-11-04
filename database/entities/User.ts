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
import { User as LysandUser } from "~types/lysand/Object";
import { htmlToText } from "html-to-text";
import { Emoji } from "./Emoji";

export const userRelations = [
	"relationships",
	"pinned_notes",
	"instance",
	"emojis",
];

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
	 * The user URI on the global network
	 */
	@Column("varchar")
	uri!: string;

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

	@Column("jsonb", {
		nullable: true,
	})
	endpoints!: {
		liked: string;
		disliked: string;
		featured: string;
		followers: string;
		following: string;
		inbox: string;
		outbox: string;
	} | null;

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
	 * The emojis for the user.
	 */
	@ManyToMany(() => Emoji, emoji => emoji.id)
	@JoinTable()
	emojis!: Emoji[];

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

	static async fetchRemoteUser(uri: string) {
		// Check if user not already in database
		const foundUser = await User.findOne({
			where: {
				uri,
			},
		});

		if (foundUser) return foundUser;

		const response = await fetch(uri, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
		});

		const data = (await response.json()) as Partial<LysandUser>;

		const user = new User();

		if (
			!(
				data.id &&
				data.username &&
				data.uri &&
				data.created_at &&
				data.disliked &&
				data.featured &&
				data.liked &&
				data.followers &&
				data.following &&
				data.inbox &&
				data.outbox &&
				data.public_key
			)
		) {
			throw new Error("Invalid user data");
		}

		user.id = data.id;
		user.username = data.username;
		user.uri = data.uri;
		user.created_at = new Date(data.created_at);
		user.endpoints = {
			disliked: data.disliked,
			featured: data.featured,
			liked: data.liked,
			followers: data.followers,
			following: data.following,
			inbox: data.inbox,
			outbox: data.outbox,
		};

		user.avatar = (data.avatar && data.avatar[0].content) || "";
		user.header = (data.header && data.header[0].content) || "";
		user.display_name = data.display_name ?? "";
		// TODO: Add bio content types
		user.note = data.bio?.[0].content ?? "";

		// Parse emojis and add them to database
		const emojis =
			data.extensions?.["org.lysand:custom_emojis"]?.emojis ?? [];

		for (const emoji of emojis) {
			user.emojis.push(await Emoji.addIfNotExists(emoji));
		}

		user.public_key = data.public_key.public_key;

		const uriData = new URL(data.uri);

		user.instance = await Instance.addIfNotExists(uriData.origin);

		await user.save();
		return user;
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
		user.uri = `${config.http.base_url}/users/${user.id}`;
		user.emojis = [];

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

	static async parseMentions(mentions: string[]) {
		return await Promise.all(
			mentions.map(async mention => {
				const user = await User.findOne({
					where: {
						uri: mention,
					},
					relations: userRelations,
				});

				if (user) return user;
				else return await User.fetchRemoteUser(mention);
			})
		);
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
		const keys = (await crypto.subtle.generateKey("Ed25519", true, [
			"sign",
			"verify",
		])) as CryptoKeyPair;

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
		// These keys are base64 encrypted
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
			emojis: await Promise.all(this.emojis.map(emoji => emoji.toAPI())),
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

	/**
	 * Should only return local users
	 */
	toLysand(): LysandUser {
		if (this.instance !== null) {
			throw new Error("Cannot convert remote user to Lysand format");
		}

		return {
			id: this.id,
			type: "User",
			uri: this.uri,
			bio: [
				{
					content: this.note,
					content_type: "text/html",
				},
				{
					content: htmlToText(this.note),
					content_type: "text/plain",
				},
			],
			created_at: new Date(this.created_at).toISOString(),
			disliked: `${this.uri}/disliked`,
			featured: `${this.uri}/featured`,
			liked: `${this.uri}/liked`,
			followers: `${this.uri}/followers`,
			following: `${this.uri}/following`,
			inbox: `${this.uri}/inbox`,
			outbox: `${this.uri}/outbox`,
			indexable: false,
			username: this.username,
			avatar: [
				{
					content: this.getAvatarUrl(getConfig()) || "",
					content_type: `image/${this.avatar.split(".")[1]}`,
				},
			],
			header: [
				{
					content: this.getHeaderUrl(getConfig()) || "",
					content_type: `image/${this.header.split(".")[1]}`,
				},
			],
			display_name: this.display_name,
			fields: this.source.fields.map(field => ({
				key: [
					{
						content: field.name,
						content_type: "text/html",
					},
					{
						content: htmlToText(field.name),
						content_type: "text/plain",
					},
				],
				value: [
					{
						content: field.value,
						content_type: "text/html",
					},
					{
						content: htmlToText(field.value),
						content_type: "text/plain",
					},
				],
			})),
			public_key: {
				actor: `${getConfig().http.base_url}/users/${this.id}`,
				public_key: this.public_key,
			},
			extensions: {
				"org.lysand:custom_emojis": {
					emojis: this.emojis.map(emoji => emoji.toLysand()),
				},
			},
		};
	}
}
