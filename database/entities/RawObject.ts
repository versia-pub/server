import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { APObject } from "activitypub-types";

/**
 * Stores an ActivityPub object as raw JSON-LD data
 */
@Entity({
	name: "objects",
})
export class RawObject extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column("json")
	data!: APObject;
}
