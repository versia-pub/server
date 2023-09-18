import {
	BaseEntity,
	Column,
	Entity,
	JoinTable,
	ManyToMany,
	PrimaryGeneratedColumn,
} from "typeorm";
import { APActivity, APActor, APObject, APTombstone } from "activitypub-types";
import { RawObject } from "./RawObject";
import { RawActor } from "./RawActor";
import { getConfig } from "@config";
import { errorResponse } from "@response";

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

	@ManyToMany(() => RawActor, actor => actor.id)
	@JoinTable()
	actors!: RawActor[];

	static async getByObjectId(id: string) {
		return await RawActivity.createQueryBuilder("activity")
			// Objects is a many-to-many relationship
			.leftJoinAndSelect("activity.objects", "objects")
			.leftJoinAndSelect("activity.actors", "actors")
			.where("objects.data @> :data", {
				data: JSON.stringify({
					id,
				}),
			})
			.getMany();
	}

	static async getById(id: string) {
		return await RawActivity.createQueryBuilder("activity")
			.leftJoinAndSelect("activity.objects", "objects")
			.leftJoinAndSelect("activity.actors", "actors")
			.where("activity.data->>'id' = :id", {
				id,
			})
			.getOne();
	}

	static async getLatestById(id: string) {
		return await RawActivity.createQueryBuilder("activity")
			// Where id is part of the jsonb column 'data'
			.where("activity.data->>'id' = :id", {
				id,
			})
			.leftJoinAndSelect("activity.objects", "objects")
			.leftJoinAndSelect("activity.actors", "actors")
			// Sort by most recent
			.orderBy("activity.data->>'published'", "DESC")
			.getOne();
	}

	static async exists(id: string) {
		return !!(await RawActivity.getById(id));
	}

	static async updateObjectIfExists(object: APObject) {
		const rawObject = await RawObject.getById(object.id ?? "");

		if (rawObject) {
			rawObject.data = object;

			// Check if object body contains any filtered terms
			if (await rawObject.isObjectFiltered())
				return errorResponse("Object filtered", 409);

			await rawObject.save();
			return rawObject;
		} else {
			return errorResponse("Object does not exist", 404);
		}
	}

	static async deleteObjectIfExists(object: APObject) {
		const dbObject = await RawObject.getById(object.id ?? "");

		if (!dbObject) return errorResponse("Object does not exist", 404);

		const config = getConfig();

		if (config.activitypub.use_tombstones) {
			dbObject.data = {
				...dbObject.data,
				type: "Tombstone",
				deleted: new Date(),
				formerType: dbObject.data.type,
			} as APTombstone;

			await dbObject.save();
		} else {
			const activities = await RawActivity.getByObjectId(object.id ?? "");

			activities.forEach(
				activity =>
					(activity.objects = activity.objects.filter(
						o => o.id !== object.id
					))
			);

			await Promise.all(
				activities.map(async activity => await activity.save())
			);

			await dbObject.remove();
		}

		return dbObject;
	}

	static async addIfNotExists(activity: APActivity) {
		if (!(await RawActivity.exists(activity.id ?? ""))) {
			const rawActivity = new RawActivity();
			rawActivity.data = {
				...activity,
				object: undefined,
				actor: undefined,
			};

			const actor = await rawActivity.addActorIfNotExists(
				activity.actor as APActor
			);

			if (actor instanceof Response) {
				return actor;
			}

			const object = await rawActivity.addObjectIfNotExists(
				activity.object as APObject
			);

			if (object instanceof Response) {
				return object;
			}

			await rawActivity.save();
			return rawActivity;
		} else {
			return errorResponse("Activity already exists", 409);
		}
	}

	async addObjectIfNotExists(object: APObject) {
		if (!this.objects.some(o => o.data.id === object.id)) {
			const rawObject = new RawObject();
			rawObject.data = object;

			// Check if object body contains any filtered terms
			if (await rawObject.isObjectFiltered())
				return errorResponse("Object filtered", 409);

			await rawObject.save();

			this.objects.push(rawObject);

			return rawObject;
		} else {
			return errorResponse("Object already exists", 409);
		}
	}

	async addActorIfNotExists(actor: APActor) {
		if (!this.actors.some(a => a.data.id === actor.id)) {
			const rawActor = new RawActor();
			rawActor.data = actor;

			const config = getConfig();

			if (
				config.activitypub.discard_avatars.find(
					instance => actor.id?.includes(instance)
				)
			) {
				rawActor.data.icon = undefined;
			}

			if (
				config.activitypub.discard_banners.find(
					instance => actor.id?.includes(instance)
				)
			) {
				rawActor.data.image = undefined;
			}

			if (await rawActor.isObjectFiltered()) {
				return errorResponse("Actor filtered", 409);
			}

			await rawActor.save();

			this.actors.push(rawActor);

			return rawActor;
		} else {
			return errorResponse("Actor already exists", 409);
		}
	}
}
