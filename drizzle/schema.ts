import type { Source as ApiSource } from "@versia/client/types";
import type { ContentFormat, InstanceMetadata } from "@versia/federation/types";
import type { Challenge } from "altcha-lib/types";
import { relations, sql } from "drizzle-orm";
import {
    type AnyPgColumn,
    boolean,
    foreignKey,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

export const Challenges = pgTable("Challenges", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    challenge: jsonb("challenge").notNull().$type<Challenge>(),
    expiresAt: timestamp("expires_at", {
        precision: 3,
        mode: "string",
    })
        .default(
            // 5 minutes
            sql`NOW() + INTERVAL '5 minutes'`,
        )
        .notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
});

export const Emojis = pgTable("Emojis", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    shortcode: text("shortcode").notNull(),
    url: text("url").notNull(),
    visibleInPicker: boolean("visible_in_picker").notNull(),
    alt: text("alt"),
    contentType: text("content_type").notNull(),
    instanceId: uuid("instanceId").references(() => Instances.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    ownerId: uuid("ownerId").references(() => Users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    category: text("category"),
});

export const Reactions = pgTable("Reaction", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    uri: text("uri").unique(),
    // Emoji ID is nullable, in which case it is a text emoji, and the emojiText field is used
    emojiId: uuid("emojiId").references(() => Emojis.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    emojiText: text("emoji_text"),
    noteId: uuid("noteId")
        .notNull()
        .references(() => Notes.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    authorId: uuid("authorId")
        .notNull()
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("update_at", {
        precision: 3,
        mode: "string",
    })
        .defaultNow()
        .notNull(),
});

export const ReactionRelations = relations(Reactions, ({ one }) => ({
    emoji: one(Emojis, {
        fields: [Reactions.emojiId],
        references: [Emojis.id],
    }),
    note: one(Notes, {
        fields: [Reactions.noteId],
        references: [Notes.id],
    }),
    author: one(Users, {
        fields: [Reactions.authorId],
        references: [Users.id],
    }),
}));

export const Filters = pgTable("Filters", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    userId: uuid("userId")
        .notNull()
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    context: text("context")
        .array()
        .notNull()
        .$type<
            ("home" | "notifications" | "public" | "thread" | "account")[]
        >(),
    title: text("title").notNull(),
    filterAction: text("filter_action").notNull().$type<"warn" | "hide">(),
    expireAt: timestamp("expires_at", { precision: 3, mode: "string" }),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
});

export const FilterKeywords = pgTable("FilterKeywords", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    filterId: uuid("filterId")
        .notNull()
        .references(() => Filters.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    keyword: text("keyword").notNull(),
    wholeWord: boolean("whole_word").notNull(),
});

export const FilterRelations = relations(Filters, ({ many }) => ({
    keywords: many(FilterKeywords),
}));

export const FilterKeywordsRelations = relations(FilterKeywords, ({ one }) => ({
    filter: one(Filters, {
        fields: [FilterKeywords.filterId],
        references: [Filters.id],
    }),
}));

export const Markers = pgTable("Markers", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    noteId: uuid("noteId").references(() => Notes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    notificationId: uuid("notificationId").references(() => Notifications.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    userId: uuid("userId")
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        })
        .notNull(),
    timeline: text("timeline").notNull().$type<"home" | "notifications">(),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
});

export const Likes = pgTable("Likes", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    uri: text("uri").unique(),
    likerId: uuid("likerId")
        .notNull()
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    likedId: uuid("likedId")
        .notNull()
        .references(() => Notes.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
});

export const VersiaObjects = pgTable(
    "VersiaObject",
    {
        id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
        remoteId: text("remote_id").notNull(),
        type: text("type").notNull(),
        uri: text("uri").notNull(),
        createdAt: timestamp("created_at", { precision: 3, mode: "string" })
            .defaultNow()
            .notNull(),
        authorId: uuid("authorId"),
        extraData: jsonb("extra_data").notNull(),
        extensions: jsonb("extensions").notNull(),
    },
    (table) => {
        return {
            remoteIdKey: uniqueIndex().on(table.remoteId),
            uriKey: uniqueIndex().on(table.uri),
            versiaObjectAuthorIdFkey: foreignKey({
                columns: [table.authorId],
                foreignColumns: [table.id],
            })
                .onUpdate("cascade")
                .onDelete("cascade"),
        };
    },
);

export const Relationships = pgTable("Relationships", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    ownerId: uuid("ownerId")
        .notNull()
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    subjectId: uuid("subjectId")
        .notNull()
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    following: boolean("following").notNull(),
    showingReblogs: boolean("showing_reblogs").notNull(),
    notifying: boolean("notifying").notNull(),
    blocking: boolean("blocking").notNull(),
    muting: boolean("muting").notNull(),
    mutingNotifications: boolean("muting_notifications").notNull(),
    requested: boolean("requested").notNull(),
    domainBlocking: boolean("domain_blocking").notNull(),
    endorsed: boolean("endorsed").notNull(),
    languages: text("languages").array(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", {
        precision: 3,
        mode: "string",
    })
        .defaultNow()
        .notNull(),
});

export const Applications = pgTable(
    "Applications",
    {
        id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
        name: text("name").notNull(),
        website: text("website"),
        vapidKey: text("vapid_key"),
        clientId: text("client_id").notNull(),
        secret: text("secret").notNull(),
        scopes: text("scopes").notNull(),
        redirectUri: text("redirect_uri").notNull(),
    },
    (table) => {
        return {
            clientIdKey: uniqueIndex().on(table.clientId),
        };
    },
);

export const ApplicationsRelations = relations(Applications, ({ many }) => ({
    tokens: many(Tokens),
    loginFlows: many(OpenIdLoginFlows),
}));

export const Tokens = pgTable("Tokens", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    tokenType: text("token_type").notNull(),
    scope: text("scope").notNull(),
    accessToken: text("access_token").notNull(),
    code: text("code"),
    expiresAt: timestamp("expires_at", { precision: 3, mode: "string" }),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
    clientId: text("client_id").notNull().default(""),
    redirectUri: text("redirect_uri").notNull().default(""),
    idToken: text("id_token"),
    userId: uuid("userId")
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        })
        .notNull(),
    applicationId: uuid("applicationId").references(() => Applications.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
});

export const Attachments = pgTable("Attachments", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    url: text("url").notNull(),
    remoteUrl: text("remote_url"),
    thumbnailUrl: text("thumbnail_url"),
    mimeType: text("mime_type").notNull(),
    description: text("description"),
    blurhash: text("blurhash"),
    sha256: text("sha256"),
    fps: integer("fps"),
    duration: integer("duration"),
    width: integer("width"),
    height: integer("height"),
    size: integer("size"),
    noteId: uuid("noteId").references(() => Notes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
});

export const Notifications = pgTable("Notifications", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    type: text("type").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
    notifiedId: uuid("notifiedId")
        .notNull()
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    accountId: uuid("accountId")
        .notNull()
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    noteId: uuid("noteId").references(() => Notes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    dismissed: boolean("dismissed").default(false).notNull(),
});

export const Notes = pgTable("Notes", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    uri: text("uri").unique(),
    authorId: uuid("authorId")
        .notNull()
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updatedAt", {
        precision: 3,
        mode: "string",
    })
        .defaultNow()
        .notNull(),
    reblogId: uuid("reblogId").references((): AnyPgColumn => Notes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    content: text("content").default("").notNull(),
    contentType: text("content_type").default("text/plain").notNull(),
    visibility: text("visibility").notNull(),
    replyId: uuid("replyId").references((): AnyPgColumn => Notes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    quotingId: uuid("quoteId").references((): AnyPgColumn => Notes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    sensitive: boolean("sensitive").notNull(),
    spoilerText: text("spoiler_text").default("").notNull(),
    applicationId: uuid("applicationId").references(() => Applications.id, {
        onDelete: "set null",
        onUpdate: "cascade",
    }),
    contentSource: text("content_source").default("").notNull(),
});

export const Instances = pgTable("Instances", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    baseUrl: text("base_url").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    logo: jsonb("logo").$type<ContentFormat>(),
    disableAutomoderation: boolean("disable_automoderation")
        .default(false)
        .notNull(),
    protocol: text("protocol")
        .notNull()
        .$type<"versia" | "activitypub">()
        .default("versia"),
    inbox: text("inbox"),
    publicKey: jsonb("public_key").$type<InstanceMetadata["public_key"]>(),
    extensions: jsonb("extensions").$type<InstanceMetadata["extensions"]>(),
});

export const OpenIdAccounts = pgTable("OpenIdAccounts", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    userId: uuid("userId").references(() => Users.id, {
        onDelete: "set null",
        onUpdate: "cascade",
    }),
    serverId: text("server_id").notNull(),
    issuerId: text("issuer_id").notNull(),
});

export const Users = pgTable(
    "Users",
    {
        id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
        uri: text("uri"),
        username: text("username").notNull(),
        displayName: text("display_name").notNull(),
        password: text("password"),
        email: text("email"),
        note: text("note").default("").notNull(),
        isAdmin: boolean("is_admin").default(false).notNull(),
        emailVerificationToken: text("email_verification_token"),
        passwordResetToken: text("password_reset_token"),
        fields: jsonb("fields").notNull().default("[]").$type<
            {
                key: ContentFormat;
                value: ContentFormat;
            }[]
        >(),
        endpoints: jsonb("endpoints").$type<Partial<{
            dislikes?: string;
            featured: string;
            likes?: string;
            followers: string;
            following: string;
            inbox: string;
            outbox: string;
        }> | null>(),
        source: jsonb("source").notNull().$type<
            ApiSource & {
                avatar?: {
                    content_type: string;
                };
                header?: {
                    content_type: string;
                };
            }
        >(),
        avatar: text("avatar").notNull(),
        header: text("header").notNull(),
        createdAt: timestamp("created_at", { precision: 3, mode: "string" })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", {
            precision: 3,
            mode: "string",
        })
            .defaultNow()
            .notNull(),
        isBot: boolean("is_bot").default(false).notNull(),
        isLocked: boolean("is_locked").default(false).notNull(),
        isDiscoverable: boolean("is_discoverable").default(false).notNull(),
        sanctions: text("sanctions").array(),
        publicKey: text("public_key").notNull(),
        privateKey: text("private_key"),
        instanceId: uuid("instanceId").references(() => Instances.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
        disableAutomoderation: boolean("disable_automoderation")
            .default(false)
            .notNull(),
    },
    (table) => {
        return {
            uriKey: uniqueIndex().on(table.uri),
            usernameKey: index().on(table.username),
            emailKey: uniqueIndex().on(table.email),
        };
    },
);

export const OpenIdLoginFlows = pgTable("OpenIdLoginFlows", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    codeVerifier: text("code_verifier").notNull(),
    applicationId: uuid("applicationId").references(() => Applications.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    issuerId: text("issuer_id").notNull(),
});

export const OpenIdLoginFlowsRelations = relations(
    OpenIdLoginFlows,
    ({ one }) => ({
        application: one(Applications, {
            fields: [OpenIdLoginFlows.applicationId],
            references: [Applications.id],
        }),
    }),
);

export const Flags = pgTable("Flags", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    flagType: text("flag_type").default("other").notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
    noteId: uuid("noteId").references(() => Notes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    userId: uuid("userId").references(() => Users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
});

export const ModNotes = pgTable("ModNotes", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    nodeId: uuid("noteId").references(() => Notes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    userId: uuid("userId").references(() => Users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    modId: uuid("modId")
        .notNull()
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
});

export const ModTags = pgTable("ModTags", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    noteId: uuid("noteId").references(() => Notes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    userId: uuid("userId").references(() => Users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    modId: uuid("modId")
        .notNull()
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    tag: text("tag").notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
});

/**
 * Permissions not prefixed with `owner:` let the role manage all instances of the resource.
 * For example, a user with the `notes` permission can manage all notes of every user
 * - Manage: Delete, Update, Create
 * - Owner: Only manage their own resources
 */
export enum RolePermissions {
    ManageNotes = "notes",
    ManageOwnNotes = "owner:note",
    ViewNotes = "read:note",
    ViewNoteLikes = "read:note_likes",
    ViewNoteBoosts = "read:note_boosts",
    ManageAccounts = "accounts",
    ManageOwnAccount = "owner:account",
    ViewAccountFollows = "read:account_follows",
    ManageLikes = "likes",
    ManageOwnLikes = "owner:like",
    ManageBoosts = "boosts",
    ManageOwnBoosts = "owner:boost",
    ViewAccounts = "read:account",
    ManageEmojis = "emojis",
    ViewEmojis = "read:emoji",
    ManageOwnEmojis = "owner:emoji",
    ManageMedia = "media",
    ManageOwnMedia = "owner:media",
    ManageBlocks = "blocks",
    ManageOwnBlocks = "owner:block",
    ManageFilters = "filters",
    ManageOwnFilters = "owner:filter",
    ManageMutes = "mutes",
    ManageOwnMutes = "owner:mute",
    ManageReports = "reports",
    ManageOwnReports = "owner:report",
    ManageSettings = "settings",
    ManageOwnSettings = "owner:settings",
    ManageRoles = "roles",
    ManageNotifications = "notifications",
    ManageOwnNotifications = "owner:notification",
    ManageFollows = "follows",
    ManageOwnFollows = "owner:follow",
    ManageOwnApps = "owner:app",
    Search = "search",
    ViewPublicTimelines = "public_timelines",
    ViewPrimateTimelines = "private_timelines",
    IgnoreRateLimits = "ignore_rate_limits",
    Impersonate = "impersonate",
    ManageInstance = "instance",
    ManageInstanceFederation = "instance:federation",
    ManageInstanceSettings = "instance:settings",
    /** Users who do not have this permission will not be able to login! */
    OAuth = "oauth",
}

export const DEFAULT_ROLES = [
    RolePermissions.ManageOwnNotes,
    RolePermissions.ViewNotes,
    RolePermissions.ViewNoteLikes,
    RolePermissions.ViewNoteBoosts,
    RolePermissions.ManageOwnAccount,
    RolePermissions.ViewAccountFollows,
    RolePermissions.ManageOwnLikes,
    RolePermissions.ManageOwnBoosts,
    RolePermissions.ViewAccounts,
    RolePermissions.ManageOwnEmojis,
    RolePermissions.ViewEmojis,
    RolePermissions.ManageOwnMedia,
    RolePermissions.ManageOwnBlocks,
    RolePermissions.ManageOwnFilters,
    RolePermissions.ManageOwnMutes,
    RolePermissions.ManageOwnReports,
    RolePermissions.ManageOwnSettings,
    RolePermissions.ManageOwnNotifications,
    RolePermissions.ManageOwnFollows,
    RolePermissions.ManageOwnApps,
    RolePermissions.Search,
    RolePermissions.ViewPublicTimelines,
    RolePermissions.ViewPrimateTimelines,
    RolePermissions.OAuth,
];

export const ADMIN_ROLES = [
    ...DEFAULT_ROLES,
    RolePermissions.ManageNotes,
    RolePermissions.ManageAccounts,
    RolePermissions.ManageLikes,
    RolePermissions.ManageBoosts,
    RolePermissions.ManageEmojis,
    RolePermissions.ManageMedia,
    RolePermissions.ManageBlocks,
    RolePermissions.ManageFilters,
    RolePermissions.ManageMutes,
    RolePermissions.ManageReports,
    RolePermissions.ManageSettings,
    RolePermissions.ManageRoles,
    RolePermissions.ManageNotifications,
    RolePermissions.ManageFollows,
    RolePermissions.Impersonate,
    RolePermissions.IgnoreRateLimits,
    RolePermissions.ManageInstance,
    RolePermissions.ManageInstanceFederation,
    RolePermissions.ManageInstanceSettings,
];

export const Roles = pgTable("Roles", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    name: text("name").notNull(),
    permissions: text("permissions")
        .array()
        .notNull()
        .$type<RolePermissions[]>(),
    priority: integer("priority").notNull().default(0),
    description: text("description"),
    visible: boolean("visible").notNull().default(false),
    icon: text("icon"),
});

export const RolesRelations = relations(Roles, ({ many }) => ({
    users: many(RoleToUsers),
}));

export const RoleToUsers = pgTable("RoleToUsers", {
    roleId: uuid("roleId")
        .notNull()
        .references(() => Roles.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    userId: uuid("userId")
        .notNull()
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
});

export const RoleToUsersRelations = relations(RoleToUsers, ({ one }) => ({
    role: one(Roles, {
        fields: [RoleToUsers.roleId],
        references: [Roles.id],
    }),
    user: one(Users, {
        fields: [RoleToUsers.userId],
        references: [Users.id],
    }),
}));

export const EmojiToUser = pgTable(
    "EmojiToUser",
    {
        emojiId: uuid("emojiId")
            .notNull()
            .references(() => Emojis.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        userId: uuid("userId")
            .notNull()
            .references(() => Users.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
    },
    (table) => {
        return {
            abUnique: uniqueIndex().on(table.emojiId, table.userId),
            bIdx: index().on(table.userId),
        };
    },
);

export const EmojiToUserRelations = relations(EmojiToUser, ({ one }) => ({
    emoji: one(Emojis, {
        fields: [EmojiToUser.emojiId],
        references: [Emojis.id],
    }),
    user: one(Users, {
        fields: [EmojiToUser.userId],
        references: [Users.id],
    }),
}));

export const EmojiToNote = pgTable(
    "EmojiToNote",
    {
        emojiId: uuid("emojiId")
            .notNull()
            .references(() => Emojis.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        noteId: uuid("noteId")
            .notNull()
            .references(() => Notes.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
    },
    (table) => {
        return {
            abUnique: uniqueIndex().on(table.emojiId, table.noteId),
            bIdx: index().on(table.noteId),
        };
    },
);

export const NoteToMentions = pgTable(
    "NoteToMentions",
    {
        noteId: uuid("noteId")
            .notNull()
            .references(() => Notes.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        userId: uuid("userId")
            .notNull()
            .references(() => Users.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
    },
    (table) => {
        return {
            abUnique: uniqueIndex().on(table.noteId, table.userId),
            bIdx: index().on(table.userId),
        };
    },
);

export const UserToPinnedNotes = pgTable(
    "UserToPinnedNotes",
    {
        userId: uuid("userId")
            .notNull()
            .references(() => Users.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        noteId: uuid("noteId")
            .notNull()
            .references(() => Notes.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
    },
    (table) => {
        return {
            abUnique: uniqueIndex().on(table.userId, table.noteId),
            bIdx: index().on(table.noteId),
        };
    },
);

export const AttachmentsRelations = relations(Attachments, ({ one }) => ({
    notes: one(Notes, {
        fields: [Attachments.noteId],
        references: [Notes.id],
    }),
}));

export const UsersRelations = relations(Users, ({ many, one }) => ({
    emojis: many(EmojiToUser),
    pinnedNotes: many(UserToPinnedNotes),
    notes: many(Notes, {
        relationName: "NoteToAuthor",
    }),
    likes: many(Likes),
    relationships: many(Relationships, {
        relationName: "RelationshipToOwner",
    }),
    relationshipSubjects: many(Relationships, {
        relationName: "RelationshipToSubject",
    }),
    notificationsMade: many(Notifications, {
        relationName: "NotificationToAccount",
    }),
    notificationsReceived: many(Notifications, {
        relationName: "NotificationToNotified",
    }),
    openIdAccounts: many(OpenIdAccounts),
    flags: many(Flags),
    modNotes: many(ModNotes),
    modTags: many(ModTags),
    tokens: many(Tokens),
    instance: one(Instances, {
        fields: [Users.instanceId],
        references: [Instances.id],
    }),
    mentionedIn: many(NoteToMentions),
    roles: many(RoleToUsers),
}));

export const RelationshipsRelations = relations(Relationships, ({ one }) => ({
    owner: one(Users, {
        fields: [Relationships.ownerId],
        references: [Users.id],
        relationName: "RelationshipToOwner",
    }),
    subject: one(Users, {
        fields: [Relationships.subjectId],
        references: [Users.id],
        relationName: "RelationshipToSubject",
    }),
}));

export const TokensRelations = relations(Tokens, ({ one }) => ({
    user: one(Users, {
        fields: [Tokens.userId],
        references: [Users.id],
    }),
    application: one(Applications, {
        fields: [Tokens.applicationId],
        references: [Applications.id],
    }),
}));

export const NotesToUsersRelations = relations(NoteToMentions, ({ one }) => ({
    note: one(Notes, {
        fields: [NoteToMentions.noteId],
        references: [Notes.id],
    }),
    user: one(Users, {
        fields: [NoteToMentions.userId],
        references: [Users.id],
    }),
}));

export const UserToPinnedNotesRelations = relations(
    UserToPinnedNotes,
    ({ one }) => ({
        note: one(Notes, {
            fields: [UserToPinnedNotes.noteId],
            references: [Notes.id],
        }),
        user: one(Users, {
            fields: [UserToPinnedNotes.userId],
            references: [Users.id],
        }),
    }),
);

export const NotesRelations = relations(Notes, ({ many, one }) => ({
    emojis: many(EmojiToNote),
    author: one(Users, {
        fields: [Notes.authorId],
        references: [Users.id],
        relationName: "NoteToAuthor",
    }),
    attachments: many(Attachments),
    mentions: many(NoteToMentions),
    reblog: one(Notes, {
        fields: [Notes.reblogId],
        references: [Notes.id],
        relationName: "NoteToReblogs",
    }),
    usersThatHavePinned: many(UserToPinnedNotes),
    reply: one(Notes, {
        fields: [Notes.replyId],
        references: [Notes.id],
        relationName: "NoteToReplies",
    }),
    quote: one(Notes, {
        fields: [Notes.quotingId],
        references: [Notes.id],
        relationName: "NoteToQuotes",
    }),
    application: one(Applications, {
        fields: [Notes.applicationId],
        references: [Applications.id],
    }),
    quotes: many(Notes, {
        relationName: "NoteToQuotes",
    }),
    replies: many(Notes, {
        relationName: "NoteToReplies",
    }),
    likes: many(Likes),
    reblogs: many(Notes, {
        relationName: "NoteToReblogs",
    }),
    notifications: many(Notifications),
}));

export const NotificationsRelations = relations(Notifications, ({ one }) => ({
    account: one(Users, {
        fields: [Notifications.accountId],
        references: [Users.id],
        relationName: "NotificationToAccount",
    }),
    notified: one(Users, {
        fields: [Notifications.notifiedId],
        references: [Users.id],
        relationName: "NotificationToNotified",
    }),
    note: one(Notes, {
        fields: [Notifications.noteId],
        references: [Notes.id],
    }),
}));

export const LikesRelations = relations(Likes, ({ one }) => ({
    liker: one(Users, {
        fields: [Likes.likerId],
        references: [Users.id],
    }),
    liked: one(Notes, {
        fields: [Likes.likedId],
        references: [Notes.id],
    }),
}));

export const EmojisRelations = relations(Emojis, ({ one, many }) => ({
    instance: one(Instances, {
        fields: [Emojis.instanceId],
        references: [Instances.id],
    }),
    users: many(EmojiToUser),
    notes: many(EmojiToNote),
}));

export const InstancesRelations = relations(Instances, ({ many }) => ({
    users: many(Users),
    emojis: many(Emojis),
}));

export const EmojisToNotesRelations = relations(EmojiToNote, ({ one }) => ({
    emoji: one(Emojis, {
        fields: [EmojiToNote.emojiId],
        references: [Emojis.id],
    }),
    note: one(Notes, {
        fields: [EmojiToNote.noteId],
        references: [Notes.id],
    }),
}));
