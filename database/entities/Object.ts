import {
	BaseEntity,
	Column,
	Entity,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { LysandObjectType } from "~types/lysand/Object";

/**
 * Represents a Lysand object in the database.
 */
@Entity({
	name: "objects",
})
export class LysandObject extends BaseEntity {
	/**
	 * The unique identifier for the object. If local, same as `remote_id`
	 */
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/**
	 * UUID of the object across the network. If the object is local, same as `id`
	 */
	remote_id!: string;

	/**
	 * Any valid Lysand type, such as `Note`, `Like`, `Follow`, etc.
	 */
	@Column("varchar")
	type!: string;

	/**
	 * Remote URI for the object
	 * Example: `https://example.com/publications/ef235cc6-d68c-4756-b0df-4e6623c4d51c`
	 */
	@Column("varchar")
	uri!: string;

	@Column("timestamp")
	created_at!: string;

	/**
	 * References an Actor object by URI
	 */
	@ManyToOne(() => LysandObject, object => object.uri, {
		nullable: true,
	})
	author!: LysandObject;

	@Column("jsonb")
	extra_data!: Omit<
		Omit<Omit<Omit<LysandObjectType, "created_at">, "id">, "uri">,
		"type"
	>;

	@Column("jsonb")
	extensions!: Record<string, any>;

	static new(type: string, uri: string): LysandObject {
		const object = new LysandObject();
		object.type = type;
		object.uri = uri;
		object.created_at = new Date().toISOString();
		return object;
	}

	isPublication(): boolean {
		return this.type === "Note" || this.type === "Patch";
	}

	isAction(): boolean {
		return [
			"Like",
			"Follow",
			"Dislike",
			"FollowAccept",
			"FollowReject",
			"Undo",
			"Announce",
		].includes(this.type);
	}

	isActor(): boolean {
		return this.type === "User";
	}

	isExtension(): boolean {
		return this.type === "Extension";
	}
}
