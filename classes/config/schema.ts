import { cwd } from "node:process";
import { type BunFile, env, file } from "bun";
import ISO6391 from "iso-639-1";
import { types as mimeTypes } from "mime-types";
import { generateVAPIDKeys } from "web-push";
import { z } from "zod";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { RolePermission } from "~/packages/client/schemas/permissions.ts";

export const DEFAULT_ROLES = [
    RolePermission.ManageOwnNotes,
    RolePermission.ViewNotes,
    RolePermission.ViewNoteLikes,
    RolePermission.ViewNoteBoosts,
    RolePermission.ManageOwnAccount,
    RolePermission.ViewAccountFollows,
    RolePermission.ManageOwnLikes,
    RolePermission.ManageOwnBoosts,
    RolePermission.ViewAccounts,
    RolePermission.ManageOwnEmojis,
    RolePermission.ViewReactions,
    RolePermission.ManageOwnReactions,
    RolePermission.ViewEmojis,
    RolePermission.ManageOwnMedia,
    RolePermission.ManageOwnBlocks,
    RolePermission.ManageOwnFilters,
    RolePermission.ManageOwnMutes,
    RolePermission.ManageOwnReports,
    RolePermission.ManageOwnSettings,
    RolePermission.ManageOwnNotifications,
    RolePermission.ManageOwnFollows,
    RolePermission.ManageOwnApps,
    RolePermission.Search,
    RolePermission.UsePushNotifications,
    RolePermission.ViewPublicTimelines,
    RolePermission.ViewPrivateTimelines,
    RolePermission.OAuth,
];

export const ADMIN_ROLES = [
    ...DEFAULT_ROLES,
    RolePermission.ManageNotes,
    RolePermission.ManageAccounts,
    RolePermission.ManageLikes,
    RolePermission.ManageBoosts,
    RolePermission.ManageEmojis,
    RolePermission.ManageReactions,
    RolePermission.ManageMedia,
    RolePermission.ManageBlocks,
    RolePermission.ManageFilters,
    RolePermission.ManageMutes,
    RolePermission.ManageReports,
    RolePermission.ManageSettings,
    RolePermission.ManageRoles,
    RolePermission.ManageNotifications,
    RolePermission.ManageFollows,
    RolePermission.Impersonate,
    RolePermission.IgnoreRateLimits,
    RolePermission.ManageInstance,
    RolePermission.ManageInstanceFederation,
    RolePermission.ManageInstanceSettings,
];

export enum MediaBackendType {
    Local = "local",
    S3 = "s3",
}

// Need to declare this here instead of importing it otherwise we get cyclical import errors
export const iso631 = z.enum(ISO6391.getAllCodes() as [string, ...string[]]);

const urlPath = z
    .string()
    .trim()
    .min(1)
    // Remove trailing slashes, but keep the root slash
    .transform((arg) => (arg === "/" ? arg : arg.replace(/\/$/, "")));

const url = z
    .string()
    .trim()
    .min(1)
    .refine((arg) => URL.canParse(arg), "Invalid url")
    .transform((arg) => new URL(arg));

const unixPort = z
    .number()
    .int()
    .min(1)
    .max(2 ** 16 - 1);

const fileFromPathString = (text: string): BunFile => file(text.slice(5));

// Not using .ip() because we allow CIDR ranges and wildcards and such
const ip = z
    .string()
    .describe("An IPv6/v4 address or CIDR range. Wildcards are also allowed");

const regex = z
    .string()
    .transform((arg) => new RegExp(arg))
    .describe("JavaScript regular expression");

export const sensitiveString = z
    .string()
    .refine(
        (text) =>
            text.startsWith("PATH:") ? fileFromPathString(text).exists() : true,
        (text) => ({
            message: `Path ${
                fileFromPathString(text).name
            } does not exist, is a directory or is not accessible`,
        }),
    )
    .transform((text) =>
        text.startsWith("PATH:") ? fileFromPathString(text).text() : text,
    )
    .describe("You can use PATH:/path/to/file to load this value from a file");

export const filePathString = z
    .string()
    .transform((s) => file(s))
    .refine(
        (file) => file.exists(),
        (file) => ({
            message: `Path ${file.name} does not exist, is a directory or is not accessible`,
        }),
    )
    .transform(async (file) => ({
        content: await file.text(),
        file,
    }))
    .describe("This value must be a file path");

export const keyPair = z
    .strictObject({
        public: sensitiveString,
        private: sensitiveString,
    })
    .optional()
    .transform(async (k, ctx) => {
        if (!k) {
            const keys = await crypto.subtle.generateKey("Ed25519", true, [
                "sign",
                "verify",
            ]);

            const privateKey = Buffer.from(
                await crypto.subtle.exportKey("pkcs8", keys.privateKey),
            ).toString("base64");

            const publicKey = Buffer.from(
                await crypto.subtle.exportKey("spki", keys.publicKey),
            ).toString("base64");

            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Public and private keys are not set. Here are generated keys for you to copy.\n\nPublic: ${publicKey}\nPrivate: ${privateKey}`,
            });

            return z.NEVER;
        }

        let publicKey: CryptoKey;
        let privateKey: CryptoKey;

        try {
            publicKey = await crypto.subtle.importKey(
                "spki",
                Buffer.from(k.public, "base64"),
                "Ed25519",
                true,
                ["verify"],
            );
        } catch {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Public key is invalid",
            });

            return z.NEVER;
        }

        try {
            privateKey = await crypto.subtle.importKey(
                "pkcs8",
                Buffer.from(k.private, "base64"),
                "Ed25519",
                true,
                ["sign"],
            );
        } catch {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Private key is invalid",
            });

            return z.NEVER;
        }

        return {
            public: publicKey,
            private: privateKey,
        };
    });

export const vapidKeyPair = z
    .strictObject({
        public: sensitiveString,
        private: sensitiveString,
    })
    .optional()
    .transform((k, ctx) => {
        if (!k) {
            const keys = generateVAPIDKeys();

            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `VAPID keys are not set. Here are generated keys for you to copy.\n\nPublic: ${keys.publicKey}\nPrivate: ${keys.privateKey}`,
            });

            return z.NEVER;
        }

        return k;
    });

export const hmacKey = sensitiveString.transform(async (text, ctx) => {
    if (!text) {
        const key = await crypto.subtle.generateKey(
            {
                name: "HMAC",
                hash: "SHA-256",
            },
            true,
            ["sign"],
        );

        const exported = await crypto.subtle.exportKey("raw", key);

        const base64 = Buffer.from(exported).toString("base64");

        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `HMAC key is not set. Here is a generated key for you to copy: ${base64}`,
        });

        return z.NEVER;
    }

    try {
        await crypto.subtle.importKey(
            "raw",
            Buffer.from(text, "base64"),
            {
                name: "HMAC",
                hash: "SHA-256",
            },
            true,
            ["sign"],
        );
    } catch {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "HMAC key is invalid",
        });

        return z.NEVER;
    }

    return text;
});

try {
    console.info();
} catch (e) {
    if (e instanceof ZodError) {
        throw fromZodError(e);
    }

    throw e;
}

export const ConfigSchema = z
    .strictObject({
        postgres: z
            .strictObject({
                host: z.string().min(1).default("localhost"),
                port: unixPort.default(5432),
                username: z.string().min(1),
                password: sensitiveString.default(""),
                database: z.string().min(1).default("versia"),
                replicas: z
                    .array(
                        z.strictObject({
                            host: z.string().min(1),
                            port: unixPort.default(5432),
                            username: z.string().min(1),
                            password: sensitiveString.default(""),
                            database: z.string().min(1).default("versia"),
                        }),
                    )
                    .describe("Additional read-only replicas")
                    .default([]),
            })
            .describe("PostgreSQL database configuration"),
        redis: z
            .strictObject({
                queue: z
                    .strictObject({
                        host: z.string().min(1).default("localhost"),
                        port: unixPort.default(6379),
                        password: sensitiveString.default(""),
                        database: z.number().int().default(0),
                    })
                    .describe("A Redis database used for managing queues."),
                cache: z
                    .strictObject({
                        host: z.string().min(1).default("localhost"),
                        port: unixPort.default(6379),
                        password: sensitiveString.default(""),
                        database: z.number().int().default(1),
                    })
                    .optional()
                    .describe(
                        "A Redis database used for caching SQL queries. Optional.",
                    ),
            })
            .describe("Redis configuration. Used for queues and caching."),
        search: z
            .strictObject({
                enabled: z
                    .boolean()
                    .default(false)
                    .describe("Enable indexing and searching?"),
                sonic: z
                    .strictObject({
                        host: z.string().min(1).default("localhost"),
                        port: unixPort.default(7700),
                        password: sensitiveString,
                    })
                    .describe("Sonic database configuration")
                    .optional(),
            })
            .refine(
                (o) => !o.enabled || o.sonic,
                "When search is enabled, Sonic configuration must be set",
            )
            .describe("Search and indexing configuration"),
        registration: z.strictObject({
            allow: z
                .boolean()
                .default(true)
                .describe("Can users sign up freely?"),
            require_approval: z.boolean().default(false),
            message: z
                .string()
                .optional()
                .describe(
                    "Message to show to users when registration is disabled",
                ),
        }),
        http: z.strictObject({
            base_url: url.describe(
                "URL that the instance will be accessible at",
            ),
            bind: z.string().min(1).default("0.0.0.0"),
            bind_port: unixPort.default(8080),
            banned_ips: z.array(ip).default([]),
            banned_user_agents: z.array(regex).default([]),
            proxy_address: url
                .optional()
                .describe("URL to an eventual HTTP proxy")
                .refine(async (url) => {
                    if (!url) {
                        return true;
                    }

                    // Test the proxy
                    const response = await fetch(
                        "https://api.ipify.org?format=json",
                        {
                            proxy: url.origin,
                        },
                    );

                    return response.ok;
                }, "The HTTP proxy address is not reachable"),
            tls: z
                .strictObject({
                    key: filePathString,
                    cert: filePathString,
                    passphrase: sensitiveString.optional(),
                    ca: filePathString.optional(),
                })
                .describe(
                    "TLS configuration. You should probably be using a reverse proxy instead of this",
                )
                .optional(),
        }),
        frontend: z.strictObject({
            enabled: z.boolean().default(true),
            path: z.string().default(env.VERSIA_FRONTEND_PATH || cwd()),
            routes: z.strictObject({
                home: urlPath.default("/"),
                login: urlPath.default("/oauth/authorize"),
                consent: urlPath.default("/oauth/consent"),
                register: urlPath.default("/register"),
                password_reset: urlPath.default("/oauth/reset"),
            }),
            settings: z.record(z.string(), z.any()).default({}),
        }),
        email: z
            .strictObject({
                send_emails: z.boolean().default(false),
                smtp: z
                    .strictObject({
                        server: z.string().min(1),
                        port: unixPort.default(465),
                        username: z.string().min(1),
                        password: sensitiveString.optional(),
                        tls: z.boolean().default(true),
                    })
                    .optional(),
            })
            .refine(
                (o) => o.send_emails || !o.smtp,
                "When send_emails is enabled, SMTP configuration must be set",
            ),
        media: z.strictObject({
            backend: z
                .nativeEnum(MediaBackendType)
                .default(MediaBackendType.Local),
            uploads_path: z.string().min(1).default("uploads"),
            conversion: z.strictObject({
                convert_images: z.boolean().default(false),
                convert_to: z.string().default("image/webp"),
                convert_vectors: z.boolean().default(false),
            }),
        }),
        s3: z
            .strictObject({
                endpoint: url,
                access_key: sensitiveString,
                secret_access_key: sensitiveString,
                region: z.string().optional(),
                bucket_name: z.string().optional(),
                public_url: url.describe(
                    "Public URL that uploaded media will be accessible at",
                ),
            })
            .optional(),
        validation: z.strictObject({
            accounts: z.strictObject({
                max_displayname_characters: z
                    .number()
                    .int()
                    .nonnegative()
                    .default(50),
                max_username_characters: z
                    .number()
                    .int()
                    .nonnegative()
                    .default(30),
                max_bio_characters: z
                    .number()
                    .int()
                    .nonnegative()
                    .default(5000),
                max_avatar_bytes: z
                    .number()
                    .int()
                    .nonnegative()
                    .default(5_000_000),
                max_header_bytes: z
                    .number()
                    .int()
                    .nonnegative()
                    .default(5_000_000),
                disallowed_usernames: z
                    .array(regex)
                    .default([
                        "well-known",
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
                max_field_count: z.number().int().default(10),
                max_field_name_characters: z.number().int().default(1000),
                max_field_value_characters: z.number().int().default(1000),
                max_pinned_notes: z.number().int().default(20),
            }),
            notes: z.strictObject({
                max_characters: z.number().int().nonnegative().default(5000),
                allowed_url_schemes: z
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
                max_attachments: z.number().int().default(16),
            }),
            media: z.strictObject({
                max_bytes: z.number().int().nonnegative().default(40_000_000),
                max_description_characters: z
                    .number()
                    .int()
                    .nonnegative()
                    .default(1000),
                allowed_mime_types: z
                    .array(z.string())
                    .default(Object.values(mimeTypes)),
            }),
            emojis: z.strictObject({
                max_bytes: z.number().int().nonnegative().default(1_000_000),
                max_shortcode_characters: z
                    .number()
                    .int()
                    .nonnegative()
                    .default(100),
                max_description_characters: z
                    .number()
                    .int()
                    .nonnegative()
                    .default(1_000),
            }),
            polls: z.strictObject({
                max_options: z.number().int().nonnegative().default(20),
                max_option_characters: z
                    .number()
                    .int()
                    .nonnegative()
                    .default(500),
                min_duration_seconds: z
                    .number()
                    .int()
                    .nonnegative()
                    .default(60),
                max_duration_seconds: z
                    .number()
                    .int()
                    .nonnegative()
                    .default(100 * 24 * 60 * 60),
            }),
            emails: z.strictObject({
                disallow_tempmail: z
                    .boolean()
                    .default(false)
                    .describe("Blocks over 10,000 common tempmail domains"),
                disallowed_domains: z.array(regex).default([]),
            }),
            challenges: z
                .strictObject({
                    difficulty: z.number().int().positive().default(50000),
                    expiration: z.number().int().positive().default(300),
                    key: hmacKey,
                })
                .optional()
                .describe(
                    "CAPTCHA challenge configuration. Challenges are disabled if not provided.",
                ),
            filters: z
                .strictObject({
                    note_content: z.array(regex).default([]),
                    emoji_shortcode: z.array(regex).default([]),
                    username: z.array(regex).default([]),
                    displayname: z.array(regex).default([]),
                    bio: z.array(regex).default([]),
                })
                .describe(
                    "Block content that matches these regular expressions",
                ),
        }),
        notifications: z.strictObject({
            push: z
                .strictObject({
                    vapid_keys: vapidKeyPair,
                    subject: z
                        .string()
                        .optional()
                        .describe(
                            "Subject field embedded in the push notification. Example: 'mailto:contact@example.com'",
                        ),
                })
                .describe(
                    "Web Push Notifications configuration. Leave out to disable.",
                )
                .optional(),
        }),
        defaults: z.strictObject({
            visibility: z
                .enum(["public", "unlisted", "private", "direct"])
                .default("public"),
            language: z.string().default("en"),
            avatar: url.optional(),
            header: url.optional(),
            placeholder_style: z
                .string()
                .default("thumbs")
                .describe("A style name from https://www.dicebear.com/styles"),
        }),
        federation: z.strictObject({
            blocked: z.array(z.string()).default([]),
            followers_only: z.array(z.string()).default([]),
            discard: z.strictObject({
                reports: z.array(z.string()).default([]),
                deletes: z.array(z.string()).default([]),
                updates: z.array(z.string()).default([]),
                media: z.array(z.string()).default([]),
                follows: z.array(z.string()).default([]),
                likes: z.array(z.string()).default([]),
                reactions: z.array(z.string()).default([]),
                banners: z.array(z.string()).default([]),
                avatars: z.array(z.string()).default([]),
            }),
            bridge: z
                .strictObject({
                    software: z.enum(["versia-ap"]).or(z.string()),
                    allowed_ips: z.array(ip).default([]),
                    token: sensitiveString,
                    url,
                })
                .optional(),
        }),
        queues: z.record(
            z.enum(["delivery", "inbox", "fetch", "push", "media"]),
            z.strictObject({
                remove_after_complete_seconds: z
                    .number()
                    .int()
                    .nonnegative()
                    // 1 year
                    .default(60 * 60 * 24 * 365),
                remove_after_failure_seconds: z
                    .number()
                    .int()
                    .nonnegative()
                    // 1 year
                    .default(60 * 60 * 24 * 365),
            }),
        ),
        instance: z.strictObject({
            name: z.string().min(1).default("Versia Server"),
            description: z.string().min(1).default("A Versia instance"),
            extended_description_path: filePathString.optional(),
            tos_path: filePathString.optional(),
            privacy_policy_path: filePathString.optional(),
            branding: z.strictObject({
                logo: url.optional(),
                banner: url.optional(),
            }),
            languages: z
                .array(iso631)
                .describe("Primary instance languages. ISO 639-1 codes."),
            contact: z.strictObject({
                email: z
                    .string()
                    .email()
                    .describe("Email to contact the instance administration"),
            }),
            rules: z
                .array(
                    z.strictObject({
                        text: z
                            .string()
                            .min(1)
                            .max(255)
                            .describe("Short description of the rule"),
                        hint: z
                            .string()
                            .min(1)
                            .max(4096)
                            .optional()
                            .describe(
                                "Longer version of the rule with additional information",
                            ),
                    }),
                )
                .default([]),
            keys: keyPair,
        }),
        permissions: z.strictObject({
            anonymous: z
                .array(z.nativeEnum(RolePermission))
                .default(DEFAULT_ROLES),
            default: z
                .array(z.nativeEnum(RolePermission))
                .default(DEFAULT_ROLES),
            admin: z.array(z.nativeEnum(RolePermission)).default(ADMIN_ROLES),
        }),
        logging: z.strictObject({
            types: z.record(
                z.enum([
                    "requests",
                    "responses",
                    "requests_content",
                    "filters",
                ]),
                z
                    .boolean()
                    .default(false)
                    .or(
                        z.strictObject({
                            level: z
                                .enum([
                                    "debug",
                                    "info",
                                    "warning",
                                    "error",
                                    "fatal",
                                ])
                                .default("info"),
                            log_file_path: z.string().optional(),
                        }),
                    ),
            ),
            log_level: z
                .enum(["debug", "info", "warning", "error", "fatal"])
                .default("info"),
            sentry: z
                .strictObject({
                    dsn: url,
                    debug: z.boolean().default(false),
                    sample_rate: z.number().min(0).max(1.0).default(1.0),
                    traces_sample_rate: z.number().min(0).max(1.0).default(1.0),
                    trace_propagation_targets: z.array(z.string()).default([]),
                    max_breadcrumbs: z.number().default(100),
                    environment: z.string().optional(),
                })
                .optional(),
            log_file_path: z.string().default("logs/versia.log"),
        }),
        debug: z
            .strictObject({
                federation: z.boolean().default(false),
            })
            .optional(),
        plugins: z.strictObject({
            autoload: z.boolean().default(true),
            overrides: z
                .strictObject({
                    enabled: z.array(z.string()).default([]),
                    disabled: z.array(z.string()).default([]),
                })
                .refine(
                    // Only one of enabled or disabled can be set
                    (arg) =>
                        arg.enabled.length === 0 || arg.disabled.length === 0,
                    "Only one of enabled or disabled can be set",
                ),
            config: z.record(z.string(), z.any()).optional(),
        }),
    })
    .refine(
        // If media backend is S3, s3 config must be set
        (arg) => arg.media.backend === MediaBackendType.Local || !!arg.s3,
        "When media backend is S3, S3 configuration must be set",
    );
