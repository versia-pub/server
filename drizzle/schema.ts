import type {
    Notification as NotificationSchema,
    Source,
    Status as StatusSchema,
} from "@versia/client/schemas";
import type { RolePermission } from "@versia/client/schemas";
import type {
    ContentFormatSchema,
    ImageContentFormatSchema,
    InstanceMetadataSchema,
    NonTextContentFormatSchema,
    TextContentFormatSchema,
} from "@versia/sdk/schemas";
import type { Challenge } from "altcha-lib/types";
import { relations, sql } from "drizzle-orm";
import {
    type AnyPgColumn,
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import type { z } from "zod";

// biome-ignore lint/nursery/useExplicitType: Type is too complex
const createdAt = () =>
    timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull();

// biome-ignore lint/nursery/useExplicitType: Type is too complex
const updatedAt = () =>
    timestamp("updated_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull();

// biome-ignore lint/nursery/useExplicitType: Type is too complex
const uri = () => text("uri").unique();

// biome-ignore lint/nursery/useExplicitType: Type is too complex
const id = () => uuid("id").primaryKey().notNull();

export const Challenges = pgTable("Challenges", {
    id: id(),
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
    createdAt: createdAt(),
});

export const Emojis = pgTable("Emojis", {
    id: id(),
    shortcode: text("shortcode").notNull(),
    mediaId: uuid("mediaId")
        .references(() => Medias.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        })
        .notNull(),
    visibleInPicker: boolean("visible_in_picker").notNull(),
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

export const EmojisRelations = relations(Emojis, ({ one, many }) => ({
    media: one(Medias, {
        fields: [Emojis.mediaId],
        references: [Medias.id],
    }),
    instance: one(Instances, {
        fields: [Emojis.instanceId],
        references: [Instances.id],
    }),
    users: many(EmojiToUser),
    notes: many(EmojiToNote),
}));

export const PushSubscriptions = pgTable("PushSubscriptions", {
    id: id(),
    endpoint: text("endpoint").notNull(),
    publicKey: text("public_key").notNull(),
    authSecret: text("auth_secret").notNull(),
    alerts: jsonb("alerts").notNull().$type<
        Partial<{
            mention: boolean;
            favourite: boolean;
            reblog: boolean;
            follow: boolean;
            poll: boolean;
            follow_request: boolean;
            status: boolean;
            update: boolean;
            "admin.sign_up": boolean;
            "admin.report": boolean;
        }>
    >(),
    policy: text("policy")
        .notNull()
        .$type<"all" | "followed" | "follower" | "none">(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    tokenId: uuid("tokenId")
        .references(() => Tokens.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        })
        .notNull()
        .unique(),
});

export const PushSubscriptionsRelations = relations(
    PushSubscriptions,
    ({ one }) => ({
        token: one(Tokens, {
            fields: [PushSubscriptions.tokenId],
            references: [Tokens.id],
        }),
    }),
);

export const Reactions = pgTable("Reaction", {
    id: id(),
    uri: uri(),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
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
    id: id(),
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
    createdAt: createdAt(),
});

export const FilterKeywords = pgTable("FilterKeywords", {
    id: id(),
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
    id: id(),
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
    createdAt: createdAt(),
});

export const Likes = pgTable("Likes", {
    id: id(),
    uri: uri(),
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
    createdAt: createdAt(),
});

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

export const Relationships = pgTable("Relationships", {
    id: id(),
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
});

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

export const Applications = pgTable(
    "Applications",
    {
        id: id(),
        name: text("name").notNull(),
        website: text("website"),
        vapidKey: text("vapid_key"),
        clientId: text("client_id").notNull(),
        secret: text("secret").notNull(),
        scopes: text("scopes").notNull(),
        redirectUri: text("redirect_uri").notNull(),
    },
    (table) => [uniqueIndex().on(table.clientId)],
);

export const ApplicationsRelations = relations(Applications, ({ many }) => ({
    tokens: many(Tokens),
    loginFlows: many(OpenIdLoginFlows),
}));

export const Tokens = pgTable("Tokens", {
    id: id(),
    tokenType: text("token_type").notNull(),
    scope: text("scope").notNull(),
    accessToken: text("access_token").notNull(),
    code: text("code"),
    expiresAt: timestamp("expires_at", { precision: 3, mode: "string" }),
    createdAt: createdAt(),
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

export const Medias = pgTable("Medias", {
    id: id(),
    content: jsonb("content")
        .notNull()
        .$type<z.infer<typeof ContentFormatSchema>>(),
    originalContent:
        jsonb("original_content").$type<z.infer<typeof ContentFormatSchema>>(),
    thumbnail:
        jsonb("thumbnail").$type<z.infer<typeof ImageContentFormatSchema>>(),
    blurhash: text("blurhash"),
});

export const MediasRelations = relations(Medias, ({ many }) => ({
    notes: many(Notes),
    emojis: many(Emojis),
    avatars: many(Users, {
        relationName: "UserToAvatar",
    }),
    headers: many(Users, {
        relationName: "UserToHeader",
    }),
}));

export const Notifications = pgTable("Notifications", {
    id: id(),
    type: text("type")
        .$type<z.infer<typeof NotificationSchema.shape.type>>()
        .notNull(),
    createdAt: createdAt(),
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

export const Notes = pgTable("Notes", {
    id: id(),
    uri: uri(),
    authorId: uuid("authorId")
        .notNull()
        .references(() => Users.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    reblogId: uuid("reblogId").references((): AnyPgColumn => Notes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    content: text("content").default("").notNull(),
    contentType: text("content_type").default("text/plain").notNull(),
    visibility: text("visibility")
        .$type<z.infer<typeof StatusSchema.shape.visibility>>()
        .notNull(),
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

export const NotesRelations = relations(Notes, ({ many, one }) => ({
    emojis: many(EmojiToNote),
    author: one(Users, {
        fields: [Notes.authorId],
        references: [Users.id],
        relationName: "NoteToAuthor",
    }),
    attachments: many(MediasToNotes, {
        relationName: "AttachmentToNote",
    }),
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

export const Instances = pgTable("Instances", {
    id: id(),
    baseUrl: text("base_url").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    logo: jsonb("logo").$type<typeof NonTextContentFormatSchema._input>(),
    disableAutomoderation: boolean("disable_automoderation")
        .default(false)
        .notNull(),
    protocol: text("protocol")
        .notNull()
        .$type<"versia" | "activitypub">()
        .default("versia"),
    inbox: text("inbox"),
    publicKey:
        jsonb("public_key").$type<
            (typeof InstanceMetadataSchema._input)["public_key"]
        >(),
    extensions:
        jsonb("extensions").$type<
            (typeof InstanceMetadataSchema._input)["extensions"]
        >(),
});

export const InstancesRelations = relations(Instances, ({ many }) => ({
    users: many(Users),
    emojis: many(Emojis),
}));

export const OpenIdAccounts = pgTable("OpenIdAccounts", {
    id: id(),
    userId: uuid("userId").references(() => Users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    serverId: text("server_id").notNull(),
    issuerId: text("issuer_id").notNull(),
});

export const Users = pgTable(
    "Users",
    {
        id: id(),
        uri: uri(),
        username: text("username").notNull(),
        displayName: text("display_name"),
        password: text("password"),
        email: text("email"),
        note: text("note").default("").notNull(),
        isAdmin: boolean("is_admin").default(false).notNull(),
        emailVerificationToken: text("email_verification_token"),
        passwordResetToken: text("password_reset_token"),
        fields: jsonb("fields").notNull().default("[]").$type<
            {
                key: z.infer<typeof TextContentFormatSchema>;
                value: z.infer<typeof TextContentFormatSchema>;
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
        source: jsonb("source").$type<z.infer<typeof Source>>(),
        avatarId: uuid("avatarId").references(() => Medias.id, {
            onDelete: "set null",
            onUpdate: "cascade",
        }),
        headerId: uuid("headerId").references(() => Medias.id, {
            onDelete: "set null",
            onUpdate: "cascade",
        }),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
        isBot: boolean("is_bot").default(false).notNull(),
        isLocked: boolean("is_locked").default(false).notNull(),
        isDiscoverable: boolean("is_discoverable").default(false).notNull(),
        isHidingCollections: boolean("is_hiding_collections")
            .default(false)
            .notNull(),
        isIndexable: boolean("is_indexable").default(true).notNull(),
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
    (table) => [
        uniqueIndex().on(table.uri),
        index().on(table.username),
        uniqueIndex().on(table.email),
    ],
);

export const UsersRelations = relations(Users, ({ many, one }) => ({
    emojis: many(EmojiToUser),
    pinnedNotes: many(UserToPinnedNotes),
    notes: many(Notes, {
        relationName: "NoteToAuthor",
    }),
    avatar: one(Medias, {
        fields: [Users.avatarId],
        references: [Medias.id],
        relationName: "UserToAvatar",
    }),
    header: one(Medias, {
        fields: [Users.headerId],
        references: [Medias.id],
        relationName: "UserToHeader",
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

export const OpenIdLoginFlows = pgTable("OpenIdLoginFlows", {
    id: id(),
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
    id: id(),
    flagType: text("flag_type").default("other").notNull(),
    createdAt: createdAt(),
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
    id: id(),
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
    createdAt: createdAt(),
});

export const ModTags = pgTable("ModTags", {
    id: id(),
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
    createdAt: createdAt(),
});

export const Roles = pgTable("Roles", {
    id: id(),
    name: text("name").notNull(),
    permissions: text("permissions")
        .array()
        .notNull()
        .$type<RolePermission[]>(),
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
    (table) => [
        uniqueIndex().on(table.emojiId, table.userId),
        index().on(table.userId),
    ],
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
    (table) => [
        uniqueIndex().on(table.emojiId, table.noteId),
        index().on(table.noteId),
    ],
);

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
    (table) => [
        uniqueIndex().on(table.noteId, table.userId),
        index().on(table.userId),
    ],
);

export const NotesToMentionsRelations = relations(
    NoteToMentions,
    ({ one }) => ({
        note: one(Notes, {
            fields: [NoteToMentions.noteId],
            references: [Notes.id],
        }),
        user: one(Users, {
            fields: [NoteToMentions.userId],
            references: [Users.id],
        }),
    }),
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
    (table) => [
        uniqueIndex().on(table.userId, table.noteId),
        index().on(table.noteId),
    ],
);

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

export const MediasToNotes = pgTable(
    "MediasToNote",
    {
        mediaId: uuid("mediaId")
            .notNull()
            .references(() => Medias.id, {
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
    (table) => [index().on(table.mediaId), index().on(table.noteId)],
);

export const MediasToNotesRelations = relations(MediasToNotes, ({ one }) => ({
    media: one(Medias, {
        fields: [MediasToNotes.mediaId],
        references: [Medias.id],
    }),
    note: one(Notes, {
        fields: [MediasToNotes.noteId],
        references: [Notes.id],
        relationName: "AttachmentToNote",
    }),
}));
