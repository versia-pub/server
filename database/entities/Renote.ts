import {
	BaseEntity,
	Column,
	Entity,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User";
import { Status } from "./Status";

/**
 * Stores an ActivityPub Renote event
 */
@Entity({
	name: "renotes",
})
export class Renote extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@ManyToOne(() => User, (user) => user.id)
	actor!: User;

	@ManyToOne(() => Status, (status) => status.id)
	object!: Status;

	@Column("datetime")
	published!: Date;
}
