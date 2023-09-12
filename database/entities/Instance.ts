import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { APIInstance } from "~types/entities/instance";
import { User } from "./User";

@Entity({
	name: "instances",
})
export class Instance extends BaseEntity {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@ManyToOne(() => User, (user) => user.id)
	contact_account!: User;

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