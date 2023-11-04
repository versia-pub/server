import {
	BaseEntity,
	CreateDateColumn,
	Entity,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User";
import { Status } from "./Status";
import { Like as LysandLike } from "~types/lysand/Object";
import { getConfig } from "@config";

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

	toLysand(): LysandLike {
		return {
			id: this.id,
			author: this.liker.uri,
			type: "Like",
			created_at: new Date(this.created_at).toISOString(),
			object: this.liked.toLysand().uri,
			uri: `${getConfig().http.base_url}/actions/${this.id}`,
		};
	}
}
