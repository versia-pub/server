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
	created_at!: Date;

	/**
	 * References an Actor object
	 */
	@ManyToOne(() => LysandObject, object => object.uri, {
		nullable: true,
	})
	author!: LysandObject | null;

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
		object.created_at = new Date();
		return object;
	}

	static async createFromObject(object: LysandObjectType) {
		let newObject: LysandObject;

		const foundObject = await LysandObject.findOne({
			where: { remote_id: object.id },
			relations: ["author"],
		});

		if (foundObject) {
			newObject = foundObject;
		} else {
			newObject = new LysandObject();
		}

		const author = await LysandObject.findOne({
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			where: { uri: (object as any).author },
		});

		newObject.author = author;
		newObject.created_at = new Date(object.created_at);
		newObject.extensions = object.extensions || {};
		newObject.remote_id = object.id;
		newObject.type = object.type;
		newObject.uri = object.uri;
		// Rest of data (remove id, author, created_at, extensions, type, uri)
		newObject.extra_data = Object.fromEntries(
			Object.entries(object).filter(
				([key]) =>
					![
						"id",
						"author",
						"created_at",
						"extensions",
						"type",
						"uri",
					].includes(key)
			)
		);

		await newObject.save();
		return newObject;
	}

	toLysand(): LysandObjectType {
		return {
			id: this.remote_id || this.id,
			created_at: new Date(this.created_at).toISOString(),
			type: this.type,
			uri: this.uri,
			...this.extra_data,
			extensions: this.extensions,
		};
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
