import {
	BaseEntity,
	Column,
	Entity,
	JoinTable,
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

	@Column("jsonb")
	data!: APActivity;

	// Any associated objects (there is typically only one)
	@ManyToMany(() => RawObject, object => object.id)
	@JoinTable()
	objects!: RawObject[];
}
