import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { APActor } from "activitypub-types";
import { getConfig } from "@config";
import { appendFile } from "fs/promises";
import { errorResponse } from "@response";

/**
 * Stores an ActivityPub actor as raw JSON-LD data
 */
@Entity({
	name: "actors",
})
export class RawActor extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column("jsonb")
	data!: APActor;

	static async getById(id: string) {
		return await RawActor.createQueryBuilder("actor")
			.where("actor.data->>'id' = :id", {
				id,
			})
			.getOne();
	}

	static async addIfNotExists(data: APActor) {
		if (!(await RawActor.exists(data.id ?? ""))) {
			const actor = new RawActor();
			actor.data = data;

			const config = getConfig();

			if (
				config.activitypub.discard_avatars.find(instance =>
					actor.id.includes(instance)
				)
			) {
				actor.data.icon = undefined;
			}

			if (
				config.activitypub.discard_banners.find(instance =>
					actor.id.includes(instance)
				)
			) {
				actor.data.image = undefined;
			}

			if (await actor.isObjectFiltered()) {
				return errorResponse("Actor filtered", 409);
			}

			await actor.save();

			return actor;
		}
		return errorResponse("Actor already exists", 409);
	}

	async isObjectFiltered() {
		const config = getConfig();

		const usernameFilterResult = await Promise.all(
			config.filters.username_filters.map(async filter => {
				if (
					this.data.type === "Person" &&
					this.data.preferredUsername?.match(filter)
				) {
					// Log filter

					if (config.logging.log_filters)
						await appendFile(
							process.cwd() + "/logs/filters.log",
							`${new Date().toISOString()} Filtered actor username: "${
								this.data.preferredUsername
							}" (ID: ${this.data.id}) based on rule: ${filter}\n`
						);
					return true;
				}
			})
		);

		const displayNameFilterResult = await Promise.all(
			config.filters.displayname_filters.map(async filter => {
				if (
					this.data.type === "Person" &&
					this.data.name?.match(filter)
				) {
					// Log filter

					if (config.logging.log_filters)
						await appendFile(
							process.cwd() + "/logs/filters.log",
							`${new Date().toISOString()} Filtered actor username: "${
								this.data.preferredUsername
							}" (ID: ${this.data.id}) based on rule: ${filter}\n`
						);
					return true;
				}
			})
		);

		return (
			usernameFilterResult.includes(true) ||
			displayNameFilterResult.includes(true)
		);
	}

	static async exists(id: string) {
		return !!(await RawActor.getById(id));
	}
}
