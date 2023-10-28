import {
	BaseEntity,
	CreateDateColumn,
	Entity,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User";
import { Status } from "./Status";

/**
 * Represents a Like entity in the database.
 */
@Entity({
	name: "likes",
})
export class Like extends BaseEntity {
	/** The unique identifier of the Like. */
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/** The User who liked the Status. */
	@ManyToOne(() => User)
	liker!: User;

	/** The Status that was liked. */
	@ManyToOne(() => Status)
	liked!: Status;

	@CreateDateColumn()
	created_at!: Date;
}
