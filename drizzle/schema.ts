import { relations, sql } from "drizzle-orm";
import {
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

export const emoji = pgTable("Emoji", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    shortcode: text("shortcode").notNull(),
    url: text("url").notNull(),
    visibleInPicker: boolean("visible_in_picker").notNull(),
    alt: text("alt"),
    contentType: text("content_type").notNull(),
    instanceId: uuid("instanceId").references(() => instance.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
});

export const like = pgTable("Like", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    likerId: uuid("likerId")
        .notNull()
        .references(() => user.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    likedId: uuid("likedId")
        .notNull()
        .references(() => status.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
});

export const lysandObject = pgTable(
    "LysandObject",
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
            lysandObjectAuthorIdFkey: foreignKey({
                columns: [table.authorId],
                foreignColumns: [table.id],
            })
                .onUpdate("cascade")
                .onDelete("cascade"),
        };
    },
);

export const relationship = pgTable("Relationship", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    ownerId: uuid("ownerId")
        .notNull()
        .references(() => user.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    subjectId: uuid("subjectId")
        .notNull()
        .references(() => user.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    following: boolean("following").notNull(),
    showingReblogs: boolean("showing_reblogs").notNull(),
    notifying: boolean("notifying").notNull(),
    followedBy: boolean("followed_by").notNull(),
    blocking: boolean("blocking").notNull(),
    blockedBy: boolean("blocked_by").notNull(),
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

export const application = pgTable(
    "Application",
    {
        id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
        name: text("name").notNull(),
        website: text("website"),
        vapidKey: text("vapid_key"),
        clientId: text("client_id").notNull(),
        secret: text("secret").notNull(),
        scopes: text("scopes").notNull(),
        redirectUris: text("redirect_uris").notNull(),
    },
    (table) => {
        return {
            clientIdKey: uniqueIndex().on(table.clientId),
        };
    },
);

export const applicationRelations = relations(application, ({ many }) => ({
    tokens: many(token),
    loginFlows: many(openIdLoginFlow),
}));

export const token = pgTable("Token", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    tokenType: text("token_type").notNull(),
    scope: text("scope").notNull(),
    accessToken: text("access_token").notNull(),
    code: text("code").notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
    userId: uuid("userId").references(() => user.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    applicationId: uuid("applicationId").references(() => application.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
});

export const attachment = pgTable("Attachment", {
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
    statusId: uuid("statusId").references(() => status.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
});

export const notification = pgTable("Notification", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    type: text("type").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
    notifiedId: uuid("notifiedId")
        .notNull()
        .references(() => user.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    accountId: uuid("accountId")
        .notNull()
        .references(() => user.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    statusId: uuid("statusId").references(() => status.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    dismissed: boolean("dismissed").default(false).notNull(),
});

export const status = pgTable(
    "Status",
    {
        id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
        uri: text("uri"),
        authorId: uuid("authorId")
            .notNull()
            .references(() => user.id, {
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
        reblogId: uuid("reblogId"),
        content: text("content").default("").notNull(),
        contentType: text("content_type").default("text/plain").notNull(),
        visibility: text("visibility").notNull(),
        inReplyToPostId: uuid("inReplyToPostId"),
        quotingPostId: uuid("quotingPostId"),
        sensitive: boolean("sensitive").notNull(),
        spoilerText: text("spoiler_text").default("").notNull(),
        applicationId: uuid("applicationId").references(() => application.id, {
            onDelete: "set null",
            onUpdate: "cascade",
        }),
        contentSource: text("content_source").default("").notNull(),
    },
    (table) => {
        return {
            uriKey: uniqueIndex().on(table.uri),
            statusReblogIdFkey: foreignKey({
                columns: [table.reblogId],
                foreignColumns: [table.id],
            })
                .onUpdate("cascade")
                .onDelete("cascade"),
            statusInReplyToPostIdFkey: foreignKey({
                columns: [table.inReplyToPostId],
                foreignColumns: [table.id],
            })
                .onUpdate("cascade")
                .onDelete("set null"),
            statusQuotingPostIdFkey: foreignKey({
                columns: [table.quotingPostId],
                foreignColumns: [table.id],
            })
                .onUpdate("cascade")
                .onDelete("set null"),
        };
    },
);

export const instance = pgTable("Instance", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    baseUrl: text("base_url").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    logo: jsonb("logo").notNull(),
    disableAutomoderation: boolean("disable_automoderation")
        .default(false)
        .notNull(),
});

export const openIdAccount = pgTable("OpenIdAccount", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    userId: uuid("userId").references(() => user.id, {
        onDelete: "set null",
        onUpdate: "cascade",
    }),
    serverId: text("server_id").notNull(),
    issuerId: text("issuer_id").notNull(),
});

export const user = pgTable(
    "User",
    {
        id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
        uri: text("uri"),
        username: text("username").notNull(),
        displayName: text("display_name").notNull(),
        password: text("password"),
        email: text("email"),
        note: text("note").default("").notNull(),
        isAdmin: boolean("is_admin").default(false).notNull(),
        endpoints: jsonb("endpoints").$type<Partial<{
            dislikes: string;
            featured: string;
            likes: string;
            followers: string;
            following: string;
            inbox: string;
            outbox: string;
        }> | null>(),
        source: jsonb("source").notNull(),
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
        instanceId: uuid("instanceId").references(() => instance.id, {
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
            usernameKey: uniqueIndex().on(table.username),
            emailKey: uniqueIndex().on(table.email),
        };
    },
);

export const openIdLoginFlow = pgTable("OpenIdLoginFlow", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    codeVerifier: text("code_verifier").notNull(),
    applicationId: uuid("applicationId").references(() => application.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    issuerId: text("issuer_id").notNull(),
});

export const openIdLoginFlowRelations = relations(
    openIdLoginFlow,
    ({ one }) => ({
        application: one(application, {
            fields: [openIdLoginFlow.applicationId],
            references: [application.id],
        }),
    }),
);

export const flag = pgTable("Flag", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    flagType: text("flag_type").default("other").notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
    flaggeStatusId: uuid("flaggeStatusId").references(() => status.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    flaggedUserId: uuid("flaggedUserId").references(() => user.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
});

export const modNote = pgTable("ModNote", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    notedStatusId: uuid("notedStatusId").references(() => status.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    notedUserId: uuid("notedUserId").references(() => user.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    modId: uuid("modId")
        .notNull()
        .references(() => user.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
});

export const modTag = pgTable("ModTag", {
    id: uuid("id").default(sql`uuid_generate_v7()`).primaryKey().notNull(),
    taggedStatusId: uuid("taggedStatusId").references(() => status.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    taggedUserId: uuid("taggedUserId").references(() => user.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
    }),
    modId: uuid("modId")
        .notNull()
        .references(() => user.id, {
            onDelete: "cascade",
            onUpdate: "cascade",
        }),
    tag: text("tag").notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "string" })
        .defaultNow()
        .notNull(),
});

export const emojiToUser = pgTable(
    "EmojiToUser",
    {
        emojiId: uuid("emojiId")
            .notNull()
            .references(() => emoji.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        userId: uuid("userId")
            .notNull()
            .references(() => user.id, {
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

export const emojiToUserRelations = relations(emojiToUser, ({ one }) => ({
    emoji: one(emoji, {
        fields: [emojiToUser.emojiId],
        references: [emoji.id],
    }),
    user: one(user, {
        fields: [emojiToUser.userId],
        references: [user.id],
    }),
}));

export const emojiToStatus = pgTable(
    "EmojiToStatus",
    {
        emojiId: uuid("emojiId")
            .notNull()
            .references(() => emoji.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        statusId: uuid("statusId")
            .notNull()
            .references(() => status.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
    },
    (table) => {
        return {
            abUnique: uniqueIndex().on(table.emojiId, table.statusId),
            bIdx: index().on(table.statusId),
        };
    },
);

export const statusToMentions = pgTable(
    "StatusToMentions",
    {
        statusId: uuid("statusId")
            .notNull()
            .references(() => status.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        userId: uuid("userId")
            .notNull()
            .references(() => user.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
    },
    (table) => {
        return {
            abUnique: uniqueIndex().on(table.statusId, table.userId),
            bIdx: index().on(table.userId),
        };
    },
);

export const userPinnedNotes = pgTable(
    "UserToPinnedNotes",
    {
        userId: uuid("userId")
            .notNull()
            .references(() => status.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
        statusId: uuid("statusId")
            .notNull()
            .references(() => user.id, {
                onDelete: "cascade",
                onUpdate: "cascade",
            }),
    },
    (table) => {
        return {
            abUnique: uniqueIndex().on(table.userId, table.statusId),
            bIdx: index().on(table.statusId),
        };
    },
);

export const attachmentRelations = relations(attachment, ({ one }) => ({
    status: one(status, {
        fields: [attachment.statusId],
        references: [status.id],
    }),
}));

export const userRelations = relations(user, ({ many, one }) => ({
    emojis: many(emojiToUser),
    pinnedNotes: many(userPinnedNotes),
    statuses: many(status, {
        relationName: "StatusToAuthor",
    }),
    likes: many(like),
    relationships: many(relationship, {
        relationName: "RelationshipToOwner",
    }),
    relationshipSubjects: many(relationship, {
        relationName: "RelationshipToSubject",
    }),
    notificationsMade: many(notification, {
        relationName: "NotificationToAccount",
    }),
    notificationsReceived: many(notification, {
        relationName: "NotificationToNotified",
    }),
    openIdAccounts: many(openIdAccount),
    flags: many(flag),
    modNotes: many(modNote),
    modTags: many(modTag),
    tokens: many(token),
    instance: one(instance, {
        fields: [user.instanceId],
        references: [instance.id],
    }),
    mentionedIn: many(statusToMentions),
}));

export const relationshipRelations = relations(relationship, ({ one }) => ({
    owner: one(user, {
        fields: [relationship.ownerId],
        references: [user.id],
        relationName: "RelationshipToOwner",
    }),
    subject: one(user, {
        fields: [relationship.subjectId],
        references: [user.id],
        relationName: "RelationshipToSubject",
    }),
}));

export const tokenRelations = relations(token, ({ one }) => ({
    user: one(user, {
        fields: [token.userId],
        references: [user.id],
    }),
    application: one(application, {
        fields: [token.applicationId],
        references: [application.id],
    }),
}));

export const statusToUserRelations = relations(statusToMentions, ({ one }) => ({
    status: one(status, {
        fields: [statusToMentions.statusId],
        references: [status.id],
    }),
    user: one(user, {
        fields: [statusToMentions.userId],
        references: [user.id],
    }),
}));

export const userPinnedNotesRelations = relations(
    userPinnedNotes,
    ({ one }) => ({
        status: one(status, {
            fields: [userPinnedNotes.statusId],
            references: [status.id],
        }),
        user: one(user, {
            fields: [userPinnedNotes.userId],
            references: [user.id],
        }),
    }),
);

export const statusRelations = relations(status, ({ many, one }) => ({
    emojis: many(emojiToStatus),
    author: one(user, {
        fields: [status.authorId],
        references: [user.id],
        relationName: "StatusToAuthor",
    }),
    attachments: many(attachment),
    mentions: many(statusToMentions),
    reblog: one(status, {
        fields: [status.reblogId],
        references: [status.id],
        relationName: "StatusToReblog",
    }),
    usersThatHavePinned: many(userPinnedNotes),
    inReplyTo: one(status, {
        fields: [status.inReplyToPostId],
        references: [status.id],
        relationName: "StatusToReplying",
    }),
    quoting: one(status, {
        fields: [status.quotingPostId],
        references: [status.id],
        relationName: "StatusToQuoting",
    }),
    application: one(application, {
        fields: [status.applicationId],
        references: [application.id],
    }),
    quotes: many(status, {
        relationName: "StatusToQuoting",
    }),
    replies: many(status, {
        relationName: "StatusToReplying",
    }),
    likes: many(like),
    reblogs: many(status, {
        relationName: "StatusToReblog",
    }),
    notifications: many(notification),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
    account: one(user, {
        fields: [notification.accountId],
        references: [user.id],
        relationName: "NotificationToAccount",
    }),
    notified: one(user, {
        fields: [notification.notifiedId],
        references: [user.id],
        relationName: "NotificationToNotified",
    }),
    status: one(status, {
        fields: [notification.statusId],
        references: [status.id],
    }),
}));

export const likeRelations = relations(like, ({ one }) => ({
    liker: one(user, {
        fields: [like.likerId],
        references: [user.id],
    }),
    liked: one(status, {
        fields: [like.likedId],
        references: [status.id],
    }),
}));

export const emojiRelations = relations(emoji, ({ one, many }) => ({
    instance: one(instance, {
        fields: [emoji.instanceId],
        references: [instance.id],
    }),
    users: many(emojiToUser),
    statuses: many(emojiToStatus),
}));

export const instanceRelations = relations(instance, ({ many }) => ({
    users: many(user),
    emojis: many(emoji),
}));

export const emojiToStatusRelations = relations(emojiToStatus, ({ one }) => ({
    emoji: one(emoji, {
        fields: [emojiToStatus.emojiId],
        references: [emoji.id],
    }),
    status: one(status, {
        fields: [emojiToStatus.statusId],
        references: [status.id],
    }),
}));
