import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { APIInstance } from "~types/entities/instance";
import { APIAccount } from "~types/entities/account";

export interface NodeInfo {
	software: {
		name: string;
		version: string;
	};
	protocols: string[];
	version: string;
	services: {
		inbound: string[];
		outbound: string[];
	};
	openRegistrations: boolean;
	usage: {
		users: {
			total: number;
			activeHalfyear: number;
			activeMonth: number;
		};
		localPosts: number;
		localComments?: number;
		remotePosts?: number;
		remoteComments?: number;
	};
	metadata: Partial<{
		nodeName: string;
		nodeDescription: string;
		maintainer: {
			name: string;
			email: string;
		};
		langs: string[];
		tosUrl: string;
		repositoryUrl: string;
		feedbackUrl: string;
		disableRegistration: boolean;
		disableLocalTimeline: boolean;
		disableRecommendedTimeline: boolean;
		disableGlobalTimeline: boolean;
		emailRequiredForSignup: boolean;
		searchFilters: boolean;
		postEditing: boolean;
		postImports: boolean;
		enableHcaptcha: boolean;
		enableRecaptcha: boolean;
		maxNoteTextLength: number;
		maxCaptionTextLength: number;
		enableTwitterIntegration: boolean;
		enableGithubIntegration: boolean;
		enableDiscordIntegration: boolean;
		enableEmail: boolean;
		enableServiceWorker: boolean;
		proxyAccountName: string | null;
		themeColor: string;
	}>;
}

/**
 * Represents an instance in the database.
 */
@Entity({
	name: "instances",
})
export class Instance extends BaseEntity {
	/**
	 * The unique identifier of the instance.
	 */
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	/**
	 * The base URL of the instance.
	 * Must not have the https:// or http:// prefix.
	 */
	@Column("varchar")
	base_url!: string;

	/**
	 * The configuration of the instance.
	 */
	@Column("jsonb", {
		nullable: true,
	})
	instance_data?: APIInstance;

	/**
	 * Instance nodeinfo data
	 */
	@Column("jsonb")
	nodeinfo!: NodeInfo;

	/**
	 * Adds an instance to the database if it doesn't already exist.
	 * @param url
	 * @returns Either the database instance if it already exists, or a newly created instance.
	 */
	static async addIfNotExists(url: string): Promise<Instance> {
		const origin = new URL(url).origin;
		const hostname = new URL(url).hostname;

		const found = await Instance.findOne({
			where: {
				base_url: hostname,
			},
		});

		if (found) return found;

		const instance = new Instance();

		instance.base_url = hostname;

		// Fetch the instance configuration
		const nodeinfo: NodeInfo = await fetch(`${origin}/nodeinfo/2.0`).then(
			res => res.json()
		);

		// Try to fetch configuration from Mastodon-compatible instances
		if (
			["firefish", "iceshrimp", "mastodon", "akkoma", "pleroma"].includes(
				nodeinfo.software.name
			)
		) {
			const instanceData: APIInstance = await fetch(
				`${origin}/api/v1/instance`
			).then(res => res.json());

			instance.instance_data = instanceData;
		}

		instance.nodeinfo = nodeinfo;

		await instance.save();

		return instance;
	}

	/**
	 * Converts the instance to an API instance.
	 * @returns The API instance.
	 */
	// eslint-disable-next-line @typescript-eslint/require-await
	async toAPI(): Promise<APIInstance> {
		return {
			uri: this.instance_data?.uri || this.base_url,
			approval_required: this.instance_data?.approval_required || false,
			email: this.instance_data?.email || "",
			thumbnail: this.instance_data?.thumbnail || "",
			title: this.instance_data?.title || "",
			version: this.instance_data?.version || "",
			configuration: this.instance_data?.configuration || {
				media_attachments: {
					image_matrix_limit: 0,
					image_size_limit: 0,
					supported_mime_types: [],
					video_frame_limit: 0,
					video_matrix_limit: 0,
					video_size_limit: 0,
				},
				polls: {
					max_characters_per_option: 0,
					max_expiration: 0,
					max_options: 0,
					min_expiration: 0,
				},
				statuses: {
					characters_reserved_per_url: 0,
					max_characters: 0,
					max_media_attachments: 0,
				},
			},
			contact_account:
				this.instance_data?.contact_account || ({} as APIAccount),
			description: this.instance_data?.description || "",
			invites_enabled: this.instance_data?.invites_enabled || false,
			languages: this.instance_data?.languages || [],
			registrations: this.instance_data?.registrations || false,
			rules: this.instance_data?.rules || [],
			stats: {
				domain_count: this.instance_data?.stats.domain_count || 0,
				status_count: this.instance_data?.stats.status_count || 0,
				user_count: this.instance_data?.stats.user_count || 0,
			},
			urls: {
				streaming_api: this.instance_data?.urls.streaming_api || "",
			},
			max_toot_chars: this.instance_data?.max_toot_chars || 0,
		};
	}
}
