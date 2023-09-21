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

@Entity({
	name: "activities",
})
export class RawActivity extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column("jsonb")
	data!: APActivity;

	@ManyToMany(() => RawObject)
	@JoinTable()
	objects!: RawObject[];

	@ManyToMany(() => RawActor)
	@JoinTable()
	actors!: RawActor[];

	static async getByObjectId(id: string) {
		return await RawActivity.createQueryBuilder("activity")
			.leftJoinAndSelect("activity.objects", "objects")
			.leftJoinAndSelect("activity.actors", "actors")
			.where("objects.data @> :data", { data: JSON.stringify({ id }) })
			.getMany();
	}

	static async getById(id: string) {
		return await RawActivity.createQueryBuilder("activity")
			.leftJoinAndSelect("activity.objects", "objects")
			.leftJoinAndSelect("activity.actors", "actors")
			.where("activity.data->>'id' = :id", { id })
			.getOne();
	}

	static async getLatestById(id: string) {
		return await RawActivity.createQueryBuilder("activity")
			.where("activity.data->>'id' = :id", { id })
			.leftJoinAndSelect("activity.objects", "objects")
			.leftJoinAndSelect("activity.actors", "actors")
			.orderBy("activity.data->>'published'", "DESC")
			.getOne();
	}

	static async exists(id: string) {
		return !!(await RawActivity.getById(id));
	}

	static async updateObjectIfExists(object: APObject) {
		const rawObject = await RawObject.getById(object.id ?? "");

		if (!rawObject) {
			return errorResponse("Object does not exist", 404);
		}

		rawObject.data = object;

		if (await rawObject.isObjectFiltered()) {
			return errorResponse("Object filtered", 409);
		}

		await rawObject.save();
		return rawObject;
	}

	static async deleteObjectIfExists(object: APObject) {
		const dbObject = await RawObject.getById(object.id ?? "");

		if (!dbObject) {
			return errorResponse("Object does not exist", 404);
		}

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

			for (const activity of activities) {
				activity.objects = activity.objects.filter(
					o => o.id !== object.id
				);
				await activity.save();
			}

			await dbObject.remove();
		}

		return dbObject;
	}

	static async addIfNotExists(activity: APActivity, addObject?: RawObject) {
		if (await RawActivity.exists(activity.id ?? "")) {
			return errorResponse("Activity already exists", 409);
		}

		const rawActivity = new RawActivity();
		rawActivity.data = { ...activity, object: undefined, actor: undefined };
		rawActivity.actors = [];
		rawActivity.objects = [];

		const actor = await rawActivity.addActorIfNotExists(
			activity.actor as APActor
		);

		if (actor instanceof Response) {
			return actor;
		}

		if (addObject) {
			rawActivity.objects.push(addObject);
		} else {
			const object = await rawActivity.addObjectIfNotExists(
				activity.object as APObject
			);

			if (object instanceof Response) {
				return object;
			}
		}

		await rawActivity.save();
		return rawActivity;
	}

	makeActivityPubRepresentation() {
		return {
			...this.data,
			object: this.objects[0].data,
			actor: this.actors[0].data,
		};
	}

	async addObjectIfNotExists(object: APObject) {
		if (this.objects.some(o => o.data.id === object.id)) {
			return errorResponse("Object already exists", 409);
		}

		const rawObject = new RawObject();
		rawObject.data = object;

		if (await rawObject.isObjectFiltered()) {
			return errorResponse("Object filtered", 409);
		}

		await rawObject.save();
		this.objects.push(rawObject);
		return rawObject;
	}

	async addActorIfNotExists(actor: APActor) {
		const dbActor = await RawActor.getByActorId(actor.id ?? "");

		if (dbActor) {
			this.actors.push(dbActor);
			return dbActor;
		}

		if (this.actors.some(a => a.data.id === actor.id)) {
			return errorResponse("Actor already exists", 409);
		}

		const rawActor = new RawActor();
		rawActor.data = actor;
		rawActor.followers = [];

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
	}
}
