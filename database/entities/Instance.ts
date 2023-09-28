import {
	BaseEntity,
	Column,
	Entity,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { APIInstance } from "~types/entities/instance";
import { User } from "./User";

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
	 * The contact account associated with the instance.
	 */
	@ManyToOne(() => User, user => user.id)
	contact_account!: User;

	/**
	 * The configuration of the instance.
	 */
	@Column("jsonb", {
		default: {
			media_attachments: {
				image_matrix_limit: 0,
				image_size_limit: 0,
				supported_mime_types: [],
				video_frame_limit: 0,
				video_matrix_limit: 0,
				video_size_limit: 0,
			},
			polls: {
				max_options: 0,
				max_characters_per_option: 0,
				max_expiration: 0,
				min_expiration: 0,
			},
			statuses: {
				characters_reserved_per_url: 0,
				max_characters: 0,
				max_media_attachments: 0,
			},
		},
	})
	configuration!: APIInstance["configuration"];

	/**
	 * Converts the instance to an API instance.
	 * @returns The API instance.
	 */
	async toAPI(): Promise<APIInstance> {
		return {
			uri: "",
			approval_required: false,
			email: "",
			thumbnail: "",
			title: "",
			version: "",
			configuration: this.configuration,
			contact_account: await this.contact_account.toAPI(),
			description: "",
			invites_enabled: false,
			languages: [],
			registrations: false,
			rules: [],
			stats: {
				domain_count: 0,
				status_count: 0,
				user_count: 0,
			},
			urls: {
				streaming_api: "",
			},
			max_toot_chars: 0,
		};
	}
}
