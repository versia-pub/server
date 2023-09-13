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

export enum TokenType {
	BEARER = "bearer",
}

@Entity({
	name: "tokens",
})
export class Token extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column("varchar")
	token_type!: TokenType;

	@Column("varchar")
	scope!: string;

	@Column("varchar")
	access_token!: string;

	@CreateDateColumn()
	created_at!: Date;

	@ManyToOne(() => User, user => user.id)
	user!: User;

	@ManyToOne(() => Application, application => application.id)
	application!: Application;
}
