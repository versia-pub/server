import { types as mimeTypes } from "mime-types";
import { z } from "zod";
import { ADMIN_ROLES, DEFAULT_ROLES, RolePermissions } from "~/drizzle/schema";

export enum MediaBackendType {
    Local = "local",
    S3 = "s3",
}

const zUrlPath = z
    .string()
    .trim()
    .min(1)
    // Remove trailing slashes, but keep the root slash
    .transform((arg) => (arg === "/" ? arg : arg.replace(/\/$/, "")));

const zUrl = z
    .string()
    .trim()
    .min(1)
    .refine((arg) => URL.canParse(arg), "Invalid url")
    .transform((arg) => arg.replace(/\/$/, ""));

export const configValidator = z.object({
    database: z.object({
        host: z.string().min(1).default("localhost"),
        port: z
            .number()
            .int()
            .min(1)
            .max(2 ** 16 - 1)
            .default(5432),
        username: z.string().min(1),
        password: z.string().default(""),
        database: z.string().min(1).default("versia"),
        replicas: z
            .array(
                z.object({
                    host: z.string().min(1),
                    port: z
                        .number()
                        .int()
                        .min(1)
                        .max(2 ** 16 - 1)
                        .default(5432),
                    username: z.string().min(1),
                    password: z.string().default(""),
                    database: z.string().min(1).default("versia"),
                }),
            )
            .optional(),
    }),
    redis: z.object({
        queue: z
            .object({
                host: z.string().min(1).default("localhost"),
                port: z
                    .number()
                    .int()
                    .min(1)
                    .max(2 ** 16 - 1)
                    .default(6379),
                password: z.string().default(""),
                database: z.number().int().default(0),
                enabled: z.boolean().default(false),
            })
            .default({
                host: "localhost",
                port: 6379,
                password: "",
                database: 0,
                enabled: false,
            }),
        cache: z
            .object({
                host: z.string().min(1).default("localhost"),
                port: z
                    .number()
                    .int()
                    .min(1)
                    .max(2 ** 16 - 1)
                    .default(6379),
                password: z.string().default(""),
                database: z.number().int().default(1),
                enabled: z.boolean().default(false),
            })
            .default({
                host: "localhost",
                port: 6379,
                password: "",
                database: 1,
                enabled: false,
            }),
    }),
    sonic: z.object({
        host: z.string().min(1).default("localhost"),
        port: z
            .number()
            .int()
            .min(1)
            .max(2 ** 16 - 1)
            .default(7700),
        password: z.string(),
        enabled: z.boolean().default(false),
    }),
    signups: z.object({
        registration: z.boolean().default(true),
        rules: z.array(z.string()).default([]),
    }),
    oidc: z.object({
        forced: z.boolean().default(false),
        allow_registration: z.boolean().default(true),
        providers: z
            .array(
                z.object({
                    name: z.string().min(1),
                    id: z.string().min(1),
                    url: z.string().min(1),
                    client_id: z.string().min(1),
                    client_secret: z.string().min(1),
                    icon: z.string().min(1).optional(),
                }),
            )
            .default([]),
        keys: z
            .object({
                public: z.string().min(1).optional(),
                private: z.string().min(1).optional(),
            })
            .optional(),
    }),
    http: z.object({
        base_url: z.string().min(1).default("http://versia.social"),
        bind: z.string().min(1).default("0.0.0.0"),
        bind_port: z
            .number()
            .int()
            .min(1)
            .max(2 ** 16 - 1)
            .default(8080),
        // Not using .ip() because we allow CIDR ranges and wildcards and such
        banned_ips: z.array(z.string()).default([]),
        banned_user_agents: z.array(z.string()).default([]),
        proxy: z
            .object({
                enabled: z.boolean().default(false),
                address: zUrl.or(z.literal("")),
            })
            .default({
                enabled: false,
                address: "",
            })
            .transform((arg) => ({
                ...arg,
                address: arg.enabled ? arg.address : undefined,
            })),
        tls: z
            .object({
                enabled: z.boolean().default(false),
                key: z.string(),
                cert: z.string(),
                passphrase: z.string().optional(),
                ca: z.string().optional(),
            })
            .default({
                enabled: false,
                key: "",
                cert: "",
                passphrase: "",
                ca: "",
            }),
        bait: z
            .object({
                enabled: z.boolean().default(false),
                send_file: z.string().optional(),
                bait_ips: z.array(z.string()).default([]),
                bait_user_agents: z.array(z.string()).default([]),
            })
            .default({
                enabled: false,
                send_file: "",
                bait_ips: [],
                bait_user_agents: [],
            }),
    }),
    frontend: z
        .object({
            enabled: z.boolean().default(true),
            url: zUrl.default("http://localhost:3000"),
            routes: z
                .object({
                    home: zUrlPath.default("/"),
                    login: zUrlPath.default("/oauth/authorize"),
                    consent: zUrlPath.default("/oauth/consent"),
                    register: zUrlPath.default("/register"),
                    password_reset: zUrlPath.default("/oauth/reset"),
                })
                .default({
                    home: "/",
                    login: "/oauth/authorize",
                    consent: "/oauth/consent",
                    register: "/register",
                    password_reset: "/oauth/reset",
                }),
            settings: z.record(z.string(), z.any()).default({}),
        })
        .default({
            enabled: true,
            url: "http://localhost:3000",
            settings: {},
        }),
    smtp: z
        .object({
            server: z.string().min(1),
            port: z
                .number()
                .int()
                .min(1)
                .max(2 ** 16 - 1)
                .default(465),
            username: z.string().min(1),
            password: z.string().min(1).optional(),
            tls: z.boolean().default(true),
            enabled: z.boolean().default(false),
        })
        .default({
            server: "",
            port: 465,
            username: "",
            password: "",
            tls: true,
            enabled: false,
        }),
    media: z
        .object({
            backend: z
                .nativeEnum(MediaBackendType)
                .default(MediaBackendType.Local),
            deduplicate_media: z.boolean().default(true),
            local_uploads_folder: z.string().min(1).default("uploads"),
            conversion: z
                .object({
                    convert_images: z.boolean().default(false),
                    convert_to: z.string().default("image/webp"),
                    convert_vector: z.boolean().default(false),
                })
                .default({
                    convert_images: false,
                    convert_to: "image/webp",
                    convert_vector: false,
                }),
        })
        .default({
            backend: MediaBackendType.Local,
            deduplicate_media: true,
            local_uploads_folder: "uploads",
            conversion: {
                convert_images: false,
                convert_to: "image/webp",
            },
        }),
    s3: z
        .object({
            endpoint: z.string(),
            access_key: z.string(),
            secret_access_key: z.string(),
            region: z.string().optional(),
            bucket_name: z.string().default("versia"),
            public_url: zUrl,
        })
        .default({
            endpoint: "",
            access_key: "",
            secret_access_key: "",
            region: undefined,
            bucket_name: "versia",
            public_url: "https://cdn.example.com",
        }),
    validation: z
        .object({
            max_displayname_size: z.number().int().default(50),
            max_bio_size: z.number().int().default(160),
            max_note_size: z.number().int().default(5000),
            max_avatar_size: z.number().int().default(5000000),
            max_header_size: z.number().int().default(5000000),
            max_media_size: z.number().int().default(40000000),
            max_media_attachments: z.number().int().default(10),
            max_media_description_size: z.number().int().default(1000),
            max_poll_options: z.number().int().default(20),
            max_poll_option_size: z.number().int().default(500),
            min_poll_duration: z.number().int().default(60),
            max_poll_duration: z.number().int().default(1893456000),
            max_username_size: z.number().int().default(30),
            max_field_count: z.number().int().default(10),
            max_field_name_size: z.number().int().default(1000),
            max_field_value_size: z.number().int().default(1000),
            username_blacklist: z
                .array(z.string())
                .default([
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
                ]),
            blacklist_tempmail: z.boolean().default(false),
            email_blacklist: z.array(z.string()).default([]),
            url_scheme_whitelist: z
                .array(z.string())
                .default([
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
                ]),
            enforce_mime_types: z.boolean().default(false),
            allowed_mime_types: z
                .array(z.string())
                .default(Object.values(mimeTypes)),
            challenges: z
                .object({
                    enabled: z.boolean().default(true),
                    difficulty: z.number().int().positive().default(50000),
                    expiration: z.number().int().positive().default(300),
                    key: z.string().default(""),
                })
                .default({
                    enabled: true,
                    difficulty: 50000,
                    expiration: 300,
                    key: "",
                }),
        })
        .default({
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
            max_field_count: 10,
            max_field_name_size: 1000,
            max_field_value_size: 1000,
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
            allowed_mime_types: Object.values(mimeTypes),
            challenges: {
                enabled: true,
                difficulty: 50000,
                expiration: 300,
                key: "",
            },
        }),
    defaults: z
        .object({
            visibility: z.string().default("public"),
            language: z.string().default("en"),
            avatar: zUrl.optional(),
            header: zUrl.optional(),
            placeholder_style: z.string().default("thumbs"),
        })
        .default({
            visibility: "public",
            language: "en",
            avatar: undefined,
            header: undefined,
            placeholder_style: "thumbs",
        }),
    federation: z
        .object({
            blocked: z.array(zUrl).default([]),
            followers_only: z.array(zUrl).default([]),
            discard: z.object({
                reports: z.array(zUrl).default([]),
                deletes: z.array(zUrl).default([]),
                updates: z.array(zUrl).default([]),
                media: z.array(zUrl).default([]),
                follows: z.array(zUrl).default([]),
                likes: z.array(zUrl).default([]),
                reactions: z.array(zUrl).default([]),
                banners: z.array(zUrl).default([]),
                avatars: z.array(zUrl).default([]),
            }),
            bridge: z
                .object({
                    enabled: z.boolean().default(false),
                    software: z.enum(["versia-ap"]).or(z.string()),
                    allowed_ips: z.array(z.string().trim()).default([]),
                    token: z.string().default(""),
                    url: zUrl.optional(),
                })
                .default({
                    enabled: false,
                    software: "versia-ap",
                    allowed_ips: [],
                    token: "",
                })
                .refine(
                    (arg) => (arg.enabled ? arg.url : true),
                    "When bridge is enabled, url must be set",
                ),
        })
        .default({
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
            bridge: {
                enabled: false,
                software: "versia-ap",
                allowed_ips: [],
                token: "",
            },
        }),
    instance: z
        .object({
            name: z.string().min(1).default("Versia"),
            description: z.string().min(1).default("A Versia instance"),
            extended_description_path: z.string().optional(),
            tos_path: z.string().optional(),
            privacy_policy_path: z.string().optional(),
            logo: zUrl.optional(),
            banner: zUrl.optional(),
            keys: z
                .object({
                    public: z.string().min(3).default("").or(z.literal("")),
                    private: z.string().min(3).default("").or(z.literal("")),
                })
                .default({
                    public: "",
                    private: "",
                }),
        })
        .default({
            name: "Versia",
            description: "A Versia instance",
            extended_description_path: undefined,
            tos_path: undefined,
            privacy_policy_path: undefined,
            logo: undefined,
            banner: undefined,
            keys: {
                public: "",
                private: "",
            },
        }),
    permissions: z
        .object({
            anonymous: z
                .array(z.nativeEnum(RolePermissions))
                .default(DEFAULT_ROLES),
            default: z
                .array(z.nativeEnum(RolePermissions))
                .default(DEFAULT_ROLES),
            admin: z.array(z.nativeEnum(RolePermissions)).default(ADMIN_ROLES),
        })
        .default({
            anonymous: DEFAULT_ROLES,
            default: DEFAULT_ROLES,
            admin: ADMIN_ROLES,
        }),
    filters: z.object({
        note_content: z.array(z.string()).default([]),
        emoji: z.array(z.string()).default([]),
        username: z.array(z.string()).default([]),
        displayname: z.array(z.string()).default([]),
        bio: z.array(z.string()).default([]),
    }),
    logging: z
        .object({
            log_requests: z.boolean().default(false),
            log_responses: z.boolean().default(false),
            log_requests_verbose: z.boolean().default(false),
            log_level: z
                .enum(["debug", "info", "warning", "error", "fatal"])
                .default("info"),
            log_ip: z.boolean().default(false),
            log_filters: z.boolean().default(true),
            sentry: z
                .object({
                    enabled: z.boolean().default(false),
                    dsn: z.string().url().or(z.literal("")).optional(),
                    debug: z.boolean().default(false),
                    sample_rate: z.number().min(0).max(1.0).default(1.0),
                    traces_sample_rate: z.number().min(0).max(1.0).default(1.0),
                    trace_propagation_targets: z.array(z.string()).default([]),
                    max_breadcrumbs: z.number().default(100),
                    environment: z.string().optional(),
                })
                .default({
                    enabled: false,
                    debug: false,
                    sample_rate: 1.0,
                    traces_sample_rate: 1.0,
                    max_breadcrumbs: 100,
                })
                .refine(
                    (arg) => (arg.enabled ? !!arg.dsn : true),
                    "When sentry is enabled, DSN must be set",
                ),
            storage: z
                .object({
                    requests: z.string().default("logs/requests.log"),
                })
                .default({
                    requests: "logs/requests.log",
                }),
        })
        .default({
            log_requests: false,
            log_responses: false,
            log_requests_verbose: false,
            log_level: "info",
            log_ip: false,
            log_filters: true,
            sentry: {
                enabled: false,
                debug: false,
                sample_rate: 1.0,
                traces_sample_rate: 1.0,
                max_breadcrumbs: 100,
            },
            storage: {
                requests: "logs/requests.log",
            },
        }),
    ratelimits: z.object({
        duration_coeff: z.number().default(1),
        max_coeff: z.number().default(1),
        custom: z
            .record(
                z.string(),
                z.object({
                    duration: z.number().default(30),
                    max: z.number().default(60),
                }),
            )
            .default({}),
    }),
    debug: z
        .object({
            federation: z.boolean().default(false),
        })
        .default({
            federation: false,
        }),
});

export type Config = z.infer<typeof configValidator>;
