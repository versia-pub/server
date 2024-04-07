import { MediaBackendType } from "~packages/media-manager";

export interface Config {
    database: {
        /** @default "localhost" */
        host: string;

        /** @default 5432 */
        port: number;

        /** @default "lysand" */
        username: string;

        /** @default "lysand" */
        password: string;

        /** @default "lysand" */
        database: string;
    };

    redis: {
        queue: {
            /** @default "localhost" */
            host: string;

            /** @default 6379 */
            port: number;

            /** @default "" */
            password: string;

            /** @default 0 */
            database: number;
        };

        cache: {
            /** @default "localhost" */
            host: string;

            /** @default 6379 */
            port: number;

            /** @default "" */
            password: string;

            /** @default 1 */
            database: number;

            /** @default false */
            enabled: boolean;
        };
    };

    meilisearch: {
        /** @default "localhost" */
        host: string;

        /** @default 7700 */
        port: number;

        /** @default "______________________________" */
        api_key: string;

        /** @default false */
        enabled: boolean;
    };

    signups: {
        /** @default "https://my-site.com/tos" */
        tos_url: string;

        /** @default true */
        registration: boolean;

        /** @default ["Do not harass others","Be nice to people","Don't spam","Don't post illegal content"] */
        rules: string[];
    };

    oidc: {
        /** @default [] */
        providers: {
            name: string;
            id: string;
            url: string;
            client_id: string;
            client_secret: string;
            icon: string;
        }[];
    };

    http: {
        /** @default "https://lysand.social" */
        base_url: string;

        /** @default "0.0.0.0" */
        bind: string;

        /** @default "8080" */
        bind_port: string;

        banned_ips: string[];

        banned_user_agents: string[];

        bait: {
            /** @default false */
            enabled: boolean;

            /** @default "" */
            send_file: string;

            /** @default ["127.0.0.1","::1"] */
            bait_ips: string[];

            /** @default ["curl","wget"] */
            bait_user_agents: string[];
        };
    };

    smtp: {
        /** @default "smtp.example.com" */
        server: string;

        /** @default 465 */
        port: number;

        /** @default "test@example.com" */
        username: string;

        /** @default "____________" */
        password: string;

        /** @default true */
        tls: boolean;

        /** @default false */
        enabled: boolean;
    };

    media: {
        /** @default "local" */
        backend: MediaBackendType;

        /** @default true */
        deduplicate_media: boolean;

        /** @default "uploads" */
        local_uploads_folder: string;

        conversion: {
            /** @default false */
            convert_images: boolean;

            /** @default "webp" */
            convert_to: string;
        };
    };

    s3: {
        /** @default "myhostname.banana.com" */
        endpoint: string;

        /** @default "_____________" */
        access_key: string;

        /** @default "_________________" */
        secret_access_key: string;

        /** @default "" */
        region: string;

        /** @default "lysand" */
        bucket_name: string;

        /** @default "https://cdn.test.com" */
        public_url: string;
    };

    email: {
        /** @default false */
        send_on_report: boolean;

        /** @default false */
        send_on_suspend: boolean;

        /** @default false */
        send_on_unsuspend: boolean;

        /** @default false */
        verify_email: boolean;
    };

    validation: {
        /** @default 50 */
        max_displayname_size: number;

        /** @default 160 */
        max_bio_size: number;

        /** @default 5000 */
        max_note_size: number;

        /** @default 5000000 */
        max_avatar_size: number;

        /** @default 5000000 */
        max_header_size: number;

        /** @default 40000000 */
        max_media_size: number;

        /** @default 10 */
        max_media_attachments: number;

        /** @default 1000 */
        max_media_description_size: number;

        /** @default 20 */
        max_poll_options: number;

        /** @default 500 */
        max_poll_option_size: number;

        /** @default 60 */
        min_poll_duration: number;

        /** @default 1893456000 */
        max_poll_duration: number;

        /** @default 30 */
        max_username_size: number;

        /** @default [".well-known","~","about","activities","api","auth","dev","inbox","internal","main","media","nodeinfo","notice","oauth","objects","proxy","push","registration","relay","settings","status","tag","users","web","search","mfa"] */
        username_blacklist: string[];

        /** @default false */
        blacklist_tempmail: boolean;

        email_blacklist: string[];

        /** @default ["http","https","ftp","dat","dweb","gopher","hyper","ipfs","ipns","irc","xmpp","ircs","magnet","mailto","mumble","ssb","gemini"] */
        url_scheme_whitelist: string[];

        /** @default false */
        enforce_mime_types: boolean;

        /** @default ["image/jpeg","image/png","image/gif","image/heic","image/heif","image/webp","image/avif","video/webm","video/mp4","video/quicktime","video/ogg","audio/wave","audio/wav","audio/x-wav","audio/x-pn-wave","audio/vnd.wave","audio/ogg","audio/vorbis","audio/mpeg","audio/mp3","audio/webm","audio/flac","audio/aac","audio/m4a","audio/x-m4a","audio/mp4","audio/3gpp","video/x-ms-asf"] */
        allowed_mime_types: string[];
    };

    defaults: {
        /** @default "public" */
        visibility: string;

        /** @default "en" */
        language: string;

        /** @default "" */
        avatar: string;

        /** @default "" */
        header: string;
    };

    federation: {
        blocked: string[];

        followers_only: string[];

        discard: {
            reports: string[];

            deletes: string[];

            updates: string[];

            media: string[];

            follows: string[];

            likes: string[];

            reactions: string[];

            banners: string[];

            avatars: string[];
        };
    };

    instance: {
        /** @default "Lysand" */
        name: string;

        /** @default "A test instance of Lysand" */
        description: string;

        /** @default "" */
        logo: string;

        /** @default "" */
        banner: string;
    };

    filters: {
        note_content: string[];

        emoji: string[];

        username: string[];

        displayname: string[];

        bio: string[];
    };

    logging: {
        /** @default false */
        log_requests: boolean;

        /** @default false */
        log_requests_verbose: boolean;

        /** @default false */
        log_ip: boolean;

        /** @default true */
        log_filters: boolean;

        storage: {
            /** @default "logs/requests.log" */
            requests: string;
        };
    };

    ratelimits: {
        /** @default 1 */
        duration_coeff: number;

        /** @default 1 */
        max_coeff: number;
    };

    /** @default {} */
    custom_ratelimits: Record<
        string,
        {
            /** @default 30 */
            duration: number;

            /** @default 60 */
            max: number;
        }
    >;
}

export const defaultConfig: Config = {
    database: {
        host: "localhost",
        port: 5432,
        username: "lysand",
        password: "lysand",
        database: "lysand",
    },
    redis: {
        queue: {
            host: "localhost",
            port: 6379,
            password: "",
            database: 0,
        },
        cache: {
            host: "localhost",
            port: 6379,
            password: "",
            database: 1,
            enabled: false,
        },
    },
    meilisearch: {
        host: "localhost",
        port: 7700,
        api_key: "______________________________",
        enabled: false,
    },
    signups: {
        tos_url: "https://my-site.com/tos",
        registration: true,
        rules: [
            "Do not harass others",
            "Be nice to people",
            "Don't spam",
            "Don't post illegal content",
        ],
    },
    oidc: {
        providers: [],
    },
    http: {
        base_url: "https://lysand.social",
        bind: "0.0.0.0",
        bind_port: "8080",
        banned_ips: [],
        banned_user_agents: [],
        bait: {
            enabled: false,
            send_file: "",
            bait_ips: ["127.0.0.1", "::1"],
            bait_user_agents: ["curl", "wget"],
        },
    },
    smtp: {
        server: "smtp.example.com",
        port: 465,
        username: "test@example.com",
        password: "____________",
        tls: true,
        enabled: false,
    },
    media: {
        backend: MediaBackendType.LOCAL,
        deduplicate_media: true,
        local_uploads_folder: "uploads",
        conversion: {
            convert_images: false,
            convert_to: "webp",
        },
    },
    s3: {
        endpoint: "myhostname.banana.com",
        access_key: "_____________",
        secret_access_key: "_________________",
        region: "",
        bucket_name: "lysand",
        public_url: "https://cdn.test.com",
    },
    email: {
        send_on_report: false,
        send_on_suspend: false,
        send_on_unsuspend: false,
        verify_email: false,
    },
    validation: {
        max_displayname_size: 50,
        max_bio_size: 160,
        max_note_size: 5000,
        max_avatar_size: 5000000,
        max_header_size: 5000000,
        max_media_size: 40000000,
        max_media_attachments: 10,
        max_media_description_size: 1000,
        max_poll_options: 20,
        max_poll_option_size: 500,
        min_poll_duration: 60,
        max_poll_duration: 1893456000,
        max_username_size: 30,
        username_blacklist: [
            ".well-known",
            "~",
            "about",
            "activities",
            "api",
            "auth",
            "dev",
            "inbox",
            "internal",
            "main",
            "media",
            "nodeinfo",
            "notice",
            "oauth",
            "objects",
            "proxy",
            "push",
            "registration",
            "relay",
            "settings",
            "status",
            "tag",
            "users",
            "web",
            "search",
            "mfa",
        ],
        blacklist_tempmail: false,
        email_blacklist: [],
        url_scheme_whitelist: [
            "http",
            "https",
            "ftp",
            "dat",
            "dweb",
            "gopher",
            "hyper",
            "ipfs",
            "ipns",
            "irc",
            "xmpp",
            "ircs",
            "magnet",
            "mailto",
            "mumble",
            "ssb",
            "gemini",
        ],
        enforce_mime_types: false,
        allowed_mime_types: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/heic",
            "image/heif",
            "image/webp",
            "image/avif",
            "video/webm",
            "video/mp4",
            "video/quicktime",
            "video/ogg",
            "audio/wave",
            "audio/wav",
            "audio/x-wav",
            "audio/x-pn-wave",
            "audio/vnd.wave",
            "audio/ogg",
            "audio/vorbis",
            "audio/mpeg",
            "audio/mp3",
            "audio/webm",
            "audio/flac",
            "audio/aac",
            "audio/m4a",
            "audio/x-m4a",
            "audio/mp4",
            "audio/3gpp",
            "video/x-ms-asf",
        ],
    },
    defaults: {
        visibility: "public",
        language: "en",
        avatar: "",
        header: "",
    },
    federation: {
        blocked: [],
        followers_only: [],
        discard: {
            reports: [],
            deletes: [],
            updates: [],
            media: [],
            follows: [],
            likes: [],
            reactions: [],
            banners: [],
            avatars: [],
        },
    },
    instance: {
        name: "Lysand",
        description: "A test instance of Lysand",
        logo: "",
        banner: "",
    },
    filters: {
        note_content: [],
        emoji: [],
        username: [],
        displayname: [],
        bio: [],
    },
    logging: {
        log_requests: false,
        log_requests_verbose: false,
        log_ip: false,
        log_filters: true,
        storage: {
            requests: "logs/requests.log",
        },
    },
    ratelimits: {
        duration_coeff: 1,
        max_coeff: 1,
    },
    custom_ratelimits: {},
};
