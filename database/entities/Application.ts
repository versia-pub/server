import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { APIApplication } from "~types/entities/application";

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

	// eslint-disable-next-line @typescript-eslint/require-await
	async toAPI(): Promise<APIApplication> {
		return {
			name: "",
			website: null,
			vapid_key: null,
		};
	}
}
