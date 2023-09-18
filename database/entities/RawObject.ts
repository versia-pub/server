import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { APObject } from "activitypub-types";
import { getConfig } from "@config";
import { appendFile } from "fs/promises";

/**
 * Stores an ActivityPub object as raw JSON-LD data
 */
@Entity({
	name: "objects",
})
export class RawObject extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column("jsonb")
	data!: APObject;

	static async getById(id: string) {
		return await RawObject.createQueryBuilder("object")
			.where("object.data->>'id' = :id", {
				id,
			})
			.getOne();
	}

	async isObjectFiltered() {
		const config = getConfig();

		const filter_result = await Promise.all(
			config.filters.note_filters.map(async filter => {
				if (
					this.data.type === "Note" &&
					this.data.content?.match(filter)
				) {
					// Log filter

					if (config.logging.log_filters)
						await appendFile(
							process.cwd() + "/logs/filters.log",
							`${new Date().toISOString()} Filtered note content: "${this.data.content.replaceAll(
								"\n",
								" "
							)}" (ID: ${
								this.data.id
							}) based on rule: ${filter}\n`
						);
					return true;
				}
			})
		);

		return filter_result.includes(true);
	}

	static async exists(id: string) {
		return !!(await RawObject.getById(id));
	}
}
