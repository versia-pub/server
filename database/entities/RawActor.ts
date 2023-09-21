import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { APActor, APOrderedCollectionPage, IconField } from "activitypub-types";
import { getConfig, getHost } from "@config";
import { appendFile } from "fs/promises";
import { errorResponse } from "@response";
import { APIAccount } from "~types/entities/account";

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

	@Column("jsonb", {
		default: [],
	})
	followers!: string[];

	static async getByActorId(id: string) {
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
			actor.followers = [];

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

	getInstanceDomain() {
		return new URL(this.data.id ?? "").host;
	}

	async fetchFollowers() {
		// Fetch follower list using ActivityPub

		// Loop to fetch all followers until there are no more pages
		let followers: APOrderedCollectionPage = await fetch(
			`${this.data.followers?.toString() ?? ""}?page=1`,
			{
				headers: {
					Accept: "application/activity+json",
				},
			}
		);

		let followersList = followers.orderedItems ?? [];

		while (followers.type === "OrderedCollectionPage" && followers.next) {
			// Fetch next page
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			followers = await fetch(followers.next.toString(), {
				headers: {
					Accept: "application/activity+json",
				},
			}).then(res => res.json());

			// Add new followers to list
			followersList = {
				...followersList,
				...(followers.orderedItems ?? []),
			};
		}

		this.followers = followersList as string[];
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async toAPIAccount(isOwnAccount = false): Promise<APIAccount> {
		const config = getConfig();
		return {
			id: this.id,
			username: this.data.preferredUsername ?? "",
			display_name: this.data.name ?? this.data.preferredUsername ?? "",
			note: this.data.summary ?? "",
			url: `${config.http.base_url}:${config.http.port}/@${
				this.data.preferredUsername
			}@${this.getInstanceDomain()}`,
			// @ts-expect-error It actually works
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			avatar: (this.data.icon as IconField).url ?? config.defaults.avatar,
			// @ts-expect-error It actually works
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			header: this.data.image?.url ?? config.defaults.header,
			locked: false,
			created_at: new Date(this.data.published ?? 0).toISOString(),
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			followers_count: 0,
			following_count: 0,
			statuses_count: 0,
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
					? `${this.data.preferredUsername}`
					: `${
							this.data.preferredUsername
					  }@${this.getInstanceDomain()}`,
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
		return !!(await RawActor.getByActorId(id));
	}
}
