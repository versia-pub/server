/* eslint-disable @typescript-eslint/require-await */
import {
	BaseEntity,
	Column,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from "typeorm";
import { APActor, APImage } from "activitypub-types";
import { getConfig, getHost } from "@config";
import { appendFile } from "fs/promises";
import { errorResponse } from "@response";
import { APIAccount } from "~types/entities/account";
import { RawActivity } from "./RawActivity";
/**
 * Represents a raw actor entity in the database.
 */
@Entity({ name: "actors" })
export class RawActor extends BaseEntity {
	/**
	 * The unique identifier of the actor.
	 */
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/**
	 * The ActivityPub actor data associated with the actor.
	 */
	@Column("jsonb")
	@Index({ unique: true, where: "(data->>'id') IS NOT NULL" })
	data!: APActor;

	/**
	 * Retrieves a RawActor entity by actor ID.
	 * @param id The ID of the actor to retrieve.
	 * @returns The RawActor entity with the specified ID, or undefined if not found.
	 */
	static async getByActorId(id: string) {
		return await RawActor.createQueryBuilder("actor")
			.where("actor.data->>'id' = :id", { id })
			.getOne();
	}

	/**
	 * Adds a new RawActor entity to the database if an actor with the same ID does not already exist.
	 * @param data The ActivityPub actor data to add.
	 * @returns The newly created RawActor entity, or an error response if the actor already exists or is filtered.
	 */
	static async addIfNotExists(data: APActor) {
		// TODO: Also add corresponding user
		if (await RawActor.exists(data.id ?? "")) {
			return errorResponse("Actor already exists", 409);
		}

		const actor = new RawActor();
		actor.data = data;

		const config = getConfig();

		if (
			config.activitypub.discard_avatars.some(instance =>
				actor.id.includes(instance)
			)
		) {
			actor.data.icon = undefined;
		}

		if (
			config.activitypub.discard_banners.some(instance =>
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

	/**
	 * Retrieves the domain of the instance associated with the actor.
	 * @returns The domain of the instance associated with the actor.
	 */
	getInstanceDomain() {
		return new URL(this.data.id ?? "").host;
	}

	/**
	 * Converts the RawActor entity to an API account object.
	 * @param isOwnAccount Whether the account is the user's own account.
	 * @returns The API account object representing the RawActor entity.
	 */
	async toAPIAccount(isOwnAccount = false): Promise<APIAccount> {
		const config = getConfig();
		const { preferredUsername, name, summary, published, icon, image } =
			this.data;

		const statusCount = await RawActivity.createQueryBuilder("activity")
			.leftJoinAndSelect("activity.actors", "actors")
			.where("actors.data @> :data", {
				data: JSON.stringify({
					id: this.data.id,
				}),
			})
			.getCount();

		const isLocalUser = this.getInstanceDomain() == getHost();

		return {
			id: this.id,
			username: preferredUsername ?? "",
			display_name: name ?? preferredUsername ?? "",
			note: summary ?? "",
			url: `${config.http.base_url}/users/${preferredUsername}${
				isLocalUser ? "" : `@${this.getInstanceDomain()}`
			}`,
			avatar:
				((icon as APImage).url as string | undefined) ??
				config.defaults.avatar,
			header:
				((image as APImage).url as string | undefined) ??
				config.defaults.header,
			locked: false,
			created_at: new Date(published ?? 0).toISOString(),
			followers_count: 0,
			following_count: 0,
			statuses_count: statusCount,
			emojis: [],
			fields: [],
			bot: false,
			source: isOwnAccount
				? {
						privacy: "public",
						sensitive: false,
						language: "en",
						note: "",
						fields: [],
				  }
				: undefined,
			avatar_static: "",
			header_static: "",
			acct:
				this.getInstanceDomain() == getHost()
					? `${preferredUsername}`
					: `${preferredUsername}@${this.getInstanceDomain()}`,
			limited: false,
			moved: null,
			noindex: false,
			suspended: false,
			discoverable: undefined,
			mute_expires_at: undefined,
			group: false,
			role: undefined,
		};
	}

	/**
	 * Determines whether the actor is filtered based on the instance's filter rules.
	 * @returns Whether the actor is filtered.
	 */
	async isObjectFiltered() {
		const config = getConfig();
		const { type, preferredUsername, name, id } = this.data;

		const usernameFilterResult = await Promise.all(
			config.filters.username_filters.map(async filter => {
				if (type === "Person" && preferredUsername?.match(filter)) {
					if (config.logging.log_filters) {
						await appendFile(
							process.cwd() + "/logs/filters.log",
							`${new Date().toISOString()} Filtered actor username: "${preferredUsername}" (ID: ${id}) based on rule: ${filter}\n`
						);
					}
					return true;
				}
			})
		);

		const displayNameFilterResult = await Promise.all(
			config.filters.displayname_filters.map(async filter => {
				if (type === "Person" && name?.match(filter)) {
					if (config.logging.log_filters) {
						await appendFile(
							process.cwd() + "/logs/filters.log",
							`${new Date().toISOString()} Filtered actor username: "${preferredUsername}" (ID: ${id}) based on rule: ${filter}\n`
						);
					}
					return true;
				}
			})
		);

		return (
			usernameFilterResult.includes(true) ||
			displayNameFilterResult.includes(true)
		);
	}

	/**
	 * Determines whether an actor with the specified ID exists in the database.
	 * @param id The ID of the actor to check for.
	 * @returns Whether an actor with the specified ID exists in the database.
	 */
	static async exists(id: string) {
		return !!(await RawActor.getByActorId(id));
	}
}
