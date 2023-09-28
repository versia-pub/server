import {
	Entity,
	BaseEntity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	ManyToOne,
} from "typeorm";
import { User } from "./User";
import { Application } from "./Application";

/**
 * Represents an access token for a user or application.
 */
@Entity({
	name: "tokens",
})
export class Token extends BaseEntity {
	/** The unique identifier for the token. */
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/** The type of token. */
	@Column("varchar")
	token_type: TokenType = TokenType.BEARER;

	/** The scope of the token. */
	@Column("varchar")
	scope!: string;

	/** The access token string. */
	@Column("varchar")
	access_token!: string;

	/** The authorization code used to obtain the token. */
	@Column("varchar")
	code!: string;

	/** The date and time the token was created. */
	@CreateDateColumn()
	created_at!: Date;

	/** The user associated with the token. */
	@ManyToOne(() => User, user => user.id)
	user!: User;

	/** The application associated with the token. */
	@ManyToOne(() => Application, application => application.id)
	application!: Application;
}

/**
 * The type of token.
 */
enum TokenType {
	BEARER = "bearer",
}
