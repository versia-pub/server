import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { ContentFormat, ServerMetadata } from "~types/lysand/Object";

/**
 * Represents an instance in the database.
 */
@Entity({
	name: "instances",
})
export class Instance extends BaseEntity {
	/**
	 * The unique identifier of the instance.
	 */
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/**
	 * The base URL of the instance.
	 * Must not have the https:// or http:// prefix.
	 */
	@Column("varchar")
	base_url!: string;

	/**
	 * The name of the instance.
	 */
	@Column("varchar")
	name!: string;

	/**
	 * The description of the instance.
	 */
	@Column("varchar")
	version!: string;

	/**
	 * The logo of the instance.
	 */
	@Column("jsonb")
	logo?: ContentFormat[];

	/**
	 * The banner of the instance.
	 */
	banner?: ContentFormat[];

	/**
	 * Adds an instance to the database if it doesn't already exist.
	 * @param url
	 * @returns Either the database instance if it already exists, or a newly created instance.
	 */
	static async addIfNotExists(url: string): Promise<Instance> {
		const origin = new URL(url).origin;
		const hostname = new URL(url).hostname;

		const found = await Instance.findOne({
			where: {
				base_url: hostname,
			},
		});

		if (found) return found;

		const instance = new Instance();

		instance.base_url = hostname;

		// Fetch the instance configuration
		const metadata = (await fetch(`${origin}/.well-known/lysand`).then(
			res => res.json()
		)) as Partial<ServerMetadata>;

		if (metadata.type !== "ServerMetadata") {
			throw new Error("Invalid instance metadata");
		}

		if (!(metadata.name && metadata.version)) {
			throw new Error("Invalid instance metadata");
		}

		instance.name = metadata.name;
		instance.version = metadata.version;
		instance.logo = metadata.logo;
		instance.banner = metadata.banner;

		await instance.save();

		return instance;
	}
}
