import type { APIAccount } from "./account";
import type { APIStats } from "./stats";
import type { APIURLs } from "./urls";

export interface APIInstance {
    tos_url: string | undefined;
    uri: string;
    title: string;
    description: string;
    email: string;
    version: string;
    thumbnail: string | null;
    urls: APIURLs;
    stats: APIStats;
    languages: string[];
    registrations: boolean;
    approval_required: boolean;
    invites_enabled: boolean;
    max_toot_chars?: number;
    configuration: {
        statuses: {
            max_characters: number;
            max_media_attachments: number;
            characters_reserved_per_url: number;
            supported_mime_types: string[];
        };
        media_attachments: {
            supported_mime_types: string[];
            image_size_limit: number;
            image_matrix_limit: number;
            video_size_limit: number;
            video_frame_limit: number;
            video_matrix_limit: number;
        };
        polls: {
            max_options: number;
            max_characters_per_option: number;
            min_expiration: number;
            max_expiration: number;
        };
    };
    contact_account: APIAccount;
    rules: APIInstanceRule[];
}

export interface APIInstanceRule {
    id: string;
    text: string;
}
