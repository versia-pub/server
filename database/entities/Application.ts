import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { APIApplication } from "~types/entities/application";
import { Token } from "./Token";

/**
 * Represents an application that can authenticate with the API.
 */
@Entity({
	name: "applications",
})
export class Application extends BaseEntity {
	/** The unique identifier for this application. */
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/** The name of this application. */
	@Column("varchar")
	name!: string;

	/** The website associated with this application, if any. */
	@Column("varchar", {
		nullable: true,
	})
	website!: string | null;

	/** The VAPID key associated with this application, if any. */
	@Column("varchar", {
		nullable: true,
	})
	vapid_key!: string | null;

	/** The client ID associated with this application. */
	@Column("varchar")
	client_id!: string;

	/** The secret associated with this application. */
	@Column("varchar")
	secret!: string;

	/** The scopes associated with this application. */
	@Column("varchar")
	scopes = "read";

	/** The redirect URIs associated with this application. */
	@Column("varchar")
	redirect_uris = "urn:ietf:wg:oauth:2.0:oob";

	/**
	 * Retrieves the application associated with the given access token.
	 * @param token The access token to retrieve the application for.
	 * @returns The application associated with the given access token, or null if no such application exists.
	 */
	static async getFromToken(token: string): Promise<Application | null> {
		const dbToken = await Token.findOne({
			where: {
				access_token: token,
			},
			relations: ["application"],
		});

		return dbToken?.application || null;
	}

	/**
	 * Converts this application to an API application.
	 * @returns The API application representation of this application.
	 */
	// eslint-disable-next-line @typescript-eslint/require-await
	async toAPI(): Promise<APIApplication> {
		return {
			name: this.name,
			website: this.website,
			vapid_key: this.vapid_key,
		};
	}
}
