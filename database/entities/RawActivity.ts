import {
	BaseEntity,
	Column,
	Entity,
	ManyToMany,
	PrimaryGeneratedColumn,
} from "typeorm";
import { APActivity } from "activitypub-types";
import { RawObject } from "./RawObject";

/**
 * Stores an ActivityPub activity as raw JSON-LD data
 */
@Entity({
	name: "activities",
})
export class RawActivity extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column("json")
	data!: APActivity;

	// Any associated objects (there is typically only one)
	@ManyToMany(() => RawObject, object => object.id)
	objects!: RawObject[];
}
