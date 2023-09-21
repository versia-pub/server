import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { APIApplication } from "~types/entities/application";
import { Token } from "./Token";

/**
 * Applications from clients
 */
@Entity({
	name: "applications",
})
export class Application extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column("varchar")
	name!: string;

	@Column("varchar", {
		nullable: true,
	})
	website!: string | null;

	@Column("varchar", {
		nullable: true,
	})
	vapid_key!: string | null;

	@Column("varchar")
	client_id!: string;

	@Column("varchar")
	secret!: string;

	@Column("varchar")
	scopes = "read";

	@Column("varchar")
	redirect_uris = "urn:ietf:wg:oauth:2.0:oob";

	static async getFromToken(token: string) {
		const dbToken = await Token.findOne({
			where: {
				access_token: token,
			},
		});

		return dbToken?.application || null;
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async toAPI(): Promise<APIApplication> {
		return {
			name: this.name,
			website: this.website,
			vapid_key: this.vapid_key,
		};
	}
}
