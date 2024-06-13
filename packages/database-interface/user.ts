import { randomBytes } from "node:crypto";
import { idValidator } from "@/api";
import { getBestContentType, urlToContentFormat } from "@/content_types";
import { addUserToMeilisearch } from "@/meilisearch";
import { proxyUrl } from "@/response";
import { EntityValidator } from "@lysand-org/federation";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    and,
    count,
    countDistinct,
    desc,
    eq,
    gte,
    inArray,
    isNotNull,
    isNull,
    sql,
} from "drizzle-orm";
import { htmlToText } from "html-to-text";
import {
    emojiToApi,
    emojiToLysand,
    fetchEmoji,
} from "~/database/entities/emoji";
import { objectToInboxRequest } from "~/database/entities/federation";
import { addInstanceIfNotExists } from "~/database/entities/instance";
import {
    type UserWithRelations,
    findFirstUser,
    findManyUsers,
} from "~/database/entities/user";
import { db } from "~/drizzle/db";
import {
    EmojiToUser,
    type Instances,
    NoteToMentions,
    Notes,
    type RolePermissions,
    UserToPinnedNotes,
    Users,
} from "~/drizzle/schema";
import { type Config, config } from "~/packages/config-manager";
import type { Account as apiAccount } from "~/types/mastodon/account";
import type { Mention as apiMention } from "~/types/mastodon/mention";
import { BaseInterface } from "./base";
import type { Note } from "./note";
import { Role } from "./role";

/**
 * Gives helpers to fetch users from database in a nice format
 */
export class User extends BaseInterface<typeof Users, UserWithRelations> {
    async reload(): Promise<void> {
        const reloaded = await User.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload user");
        }

        this.data = reloaded.data;
    }

    static async fromId(id: string | null): Promise<User | null> {
        if (!id) {
            return null;
        }

        return await User.fromSql(eq(Users.id, id));
    }

    static async fromIds(ids: string[]): Promise<User[]> {
        return await User.manyFromSql(inArray(Users.id, ids));
    }

    static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Users.id),
    ) {
        const found = await findFirstUser({
            where: sql,
            orderBy,
        });

        if (!found) {
            return null;
        }
        return new User(found);
    }

    static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Users.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Users.findMany>[0],
    ) {
        const found = await findManyUsers({
            where: sql,
            orderBy,
            limit,
            offset,
            with: extra?.with,
        });

        return found.map((s) => new User(s));
    }

    get id() {
        return this.data.id;
    }

    isLocal() {
        return this.data.instanceId === null;
    }

    isRemote() {
        return !this.isLocal();
    }

    getUri() {
        return (
            this.data.uri ||
            new URL(`/users/${this.data.id}`, config.http.base_url).toString()
        );
    }

    static getUri(id: string, uri: string | null, baseUrl: string) {
        return uri || new URL(`/users/${id}`, baseUrl).toString();
    }

    public hasPermission(permission: RolePermissions) {
        return this.getAllPermissions().includes(permission);
    }

    public getAllPermissions() {
        return (
            this.data.roles
                .flatMap((role) => role.permissions)
                // Add default permissions
                .concat(config.permissions.default)
                // If admin, add admin permissions
                .concat(this.data.isAdmin ? config.permissions.admin : [])
                .reduce((acc, permission) => {
                    if (!acc.includes(permission)) {
                        acc.push(permission);
                    }
                    return acc;
                }, [] as RolePermissions[])
        );
    }

    static async getCount() {
        return (
            await db
                .select({
                    count: count(),
                })
                .from(Users)
                .where(isNull(Users.instanceId))
        )[0].count;
    }

    static async getActiveInPeriod(milliseconds: number) {
        return (
            await db
                .select({
                    count: countDistinct(Users),
                })
                .from(Users)
                .leftJoin(Notes, eq(Users.id, Notes.authorId))
                .where(
                    and(
                        isNull(Users.instanceId),
                        gte(
                            Notes.createdAt,
                            new Date(Date.now() - milliseconds).toISOString(),
                        ),
                    ),
                )
        )[0].count;
    }

    async delete(ids: string[]): Promise<void>;
    async delete(): Promise<void>;
    async delete(ids?: unknown): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Users).where(inArray(Users.id, ids));
        } else {
            await db.delete(Users).where(eq(Users.id, this.id));
        }
    }

    async resetPassword() {
        const resetToken = await randomBytes(32).toString("hex");

        await this.update({
            passwordResetToken: resetToken,
        });

        return resetToken;
    }

    async pin(note: Note) {
        return (
            await db
                .insert(UserToPinnedNotes)
                .values({
                    noteId: note.id,
                    userId: this.id,
                })
                .returning()
        )[0];
    }

    async unpin(note: Note) {
        return (
            await db
                .delete(UserToPinnedNotes)
                .where(
                    and(
                        eq(NoteToMentions.noteId, note.id),
                        eq(NoteToMentions.userId, this.id),
                    ),
                )
                .returning()
        )[0];
    }

    save(): Promise<UserWithRelations> {
        return this.update(this.data);
    }

    async updateFromRemote(): Promise<User> {
        if (!this.isRemote()) {
            throw new Error(
                "Cannot refetch a local user (they are not remote)",
            );
        }

        const updated = await User.saveFromRemote(this.getUri());

        this.data = updated.data;

        return this;
    }

    static async saveFromRemote(uri: string): Promise<User> {
        if (!URL.canParse(uri)) {
            throw new Error(`Invalid URI to parse ${uri}`);
        }

        const response = await fetch(uri, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        });

        const json = (await response.json()) as Partial<
            typeof EntityValidator.$User
        >;

        const validator = new EntityValidator();

        const data = await validator.User(json);

        // Parse emojis and add them to database
        const userEmojis =
            data.extensions?.["org.lysand:custom_emojis"]?.emojis ?? [];

        const instance = await addInstanceIfNotExists(data.uri);

        const emojis = [];

        for (const emoji of userEmojis) {
            emojis.push(await fetchEmoji(emoji));
        }

        const user = await User.fromLysand(data, instance);

        // Add emojis to user
        if (emojis.length > 0) {
            await db.delete(EmojiToUser).where(eq(EmojiToUser.userId, user.id));

            await db.insert(EmojiToUser).values(
                emojis.map((emoji) => ({
                    emojiId: emoji.id,
                    userId: user.id,
                })),
            );
        }

        const finalUser = await User.fromId(user.id);

        if (!finalUser) {
            throw new Error("Failed to save user from remote");
        }

        // Add to Meilisearch
        await addUserToMeilisearch(finalUser);

        return finalUser;
    }

    static async fromLysand(
        user: typeof EntityValidator.$User,
        instance: InferSelectModel<typeof Instances>,
    ): Promise<User> {
        const data = {
            username: user.username,
            uri: user.uri,
            createdAt: new Date(user.created_at).toISOString(),
            endpoints: {
                dislikes: user.dislikes,
                featured: user.featured,
                likes: user.likes,
                followers: user.followers,
                following: user.following,
                inbox: user.inbox,
                outbox: user.outbox,
            },
            fields: user.fields ?? [],
            updatedAt: new Date(user.created_at).toISOString(),
            instanceId: instance.id,
            avatar: user.avatar
                ? Object.entries(user.avatar)[0][1].content
                : "",
            header: user.header
                ? Object.entries(user.header)[0][1].content
                : "",
            displayName: user.display_name ?? "",
            note: getBestContentType(user.bio).content,
            publicKey: user.public_key.public_key,
            source: {
                language: null,
                note: "",
                privacy: "public",
                sensitive: false,
                fields: [],
            },
        };

        // Check if new user already exists

        const foundUser = await User.fromSql(eq(Users.uri, user.uri));

        // If it exists, simply update it
        if (foundUser) {
            await foundUser.update(data);

            return foundUser;
        }

        // Else, create a new user
        return await User.insert(data);
    }

    public static async insert(
        data: InferInsertModel<typeof Users>,
    ): Promise<User> {
        const inserted = (await db.insert(Users).values(data).returning())[0];

        const user = await User.fromId(inserted.id);

        if (!user) {
            throw new Error("Failed to insert user");
        }

        return user;
    }

    static async resolve(uri: string): Promise<User | null> {
        // Check if user not already in database
        const foundUser = await User.fromSql(eq(Users.uri, uri));

        if (foundUser) {
            return foundUser;
        }

        // Check if URI is of a local user
        if (uri.startsWith(config.http.base_url)) {
            const uuid = uri.match(idValidator);

            if (!uuid?.[0]) {
                throw new Error(
                    `URI ${uri} is of a local user, but it could not be parsed`,
                );
            }

            return await User.fromId(uuid[0]);
        }

        return await User.saveFromRemote(uri);
    }

    /**
     * Get the user's avatar in raw URL format
     * @param config The config to use
     * @returns The raw URL for the user's avatar
     */
    getAvatarUrl(config: Config) {
        if (!this.data.avatar) {
            return (
                config.defaults.avatar ||
                `https://api.dicebear.com/8.x/${config.defaults.placeholder_style}/svg?seed=${this.data.username}`
            );
        }
        return this.data.avatar;
    }

    static async generateKeys() {
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

        // Add header, footer and newlines later on
        // These keys are base64 encrypted
        return {
            private_key: privateKey,
            public_key: publicKey,
        };
    }

    static async fromDataLocal(data: {
        username: string;
        display_name?: string;
        password: string | undefined;
        email: string | undefined;
        bio?: string;
        avatar?: string;
        header?: string;
        admin?: boolean;
        skipPasswordHash?: boolean;
    }): Promise<User | null> {
        const keys = await User.generateKeys();

        const newUser = (
            await db
                .insert(Users)
                .values({
                    username: data.username,
                    displayName: data.display_name ?? data.username,
                    password:
                        data.skipPasswordHash || !data.password
                            ? data.password
                            : await Bun.password.hash(data.password),
                    email: data.email,
                    note: data.bio ?? "",
                    avatar: data.avatar ?? config.defaults.avatar ?? "",
                    header: data.header ?? config.defaults.avatar ?? "",
                    isAdmin: data.admin ?? false,
                    publicKey: keys.public_key,
                    fields: [],
                    privateKey: keys.private_key,
                    updatedAt: new Date().toISOString(),
                    source: {
                        language: null,
                        note: "",
                        privacy: "public",
                        sensitive: false,
                        fields: [],
                    },
                })
                .returning()
        )[0];

        const finalUser = await User.fromId(newUser.id);

        if (!finalUser) {
            return null;
        }

        // Add to Meilisearch
        await addUserToMeilisearch(finalUser);

        return finalUser;
    }

    /**
     * Get the user's header in raw URL format
     * @param config The config to use
     * @returns The raw URL for the user's header
     */
    getHeaderUrl(config: Config) {
        if (!this.data.header) {
            return config.defaults.header || "";
        }
        return this.data.header;
    }

    getAcct() {
        return this.isLocal()
            ? this.data.username
            : `${this.data.username}@${this.data.instance?.baseUrl}`;
    }

    static getAcct(isLocal: boolean, username: string, baseUrl?: string) {
        return isLocal ? username : `${username}@${baseUrl}`;
    }

    async update(
        newUser: Partial<UserWithRelations>,
    ): Promise<UserWithRelations> {
        await db.update(Users).set(newUser).where(eq(Users.id, this.id));

        const updated = await User.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update user");
        }

        // If something important is updated, federate it
        if (
            newUser.username ||
            newUser.displayName ||
            newUser.note ||
            newUser.avatar ||
            newUser.header ||
            newUser.fields ||
            newUser.publicKey ||
            newUser.isAdmin ||
            newUser.isBot ||
            newUser.isLocked ||
            newUser.endpoints ||
            newUser.isDiscoverable
        ) {
            await this.federateToFollowers(this.toLysand());
        }

        return updated.data;
    }

    async federateToFollowers(object: typeof EntityValidator.$Entity) {
        // Get followers
        const followers = await User.manyFromSql(
            and(
                sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${this.id} AND "Relationships"."ownerId" = ${Users.id} AND "Relationships"."following" = true)`,
                isNotNull(Users.instanceId),
            ),
        );

        for (const follower of followers) {
            const federationRequest = await objectToInboxRequest(
                object,
                this,
                follower,
            );

            // FIXME: Add to new queue system when it's implemented
            fetch(federationRequest);
        }
    }

    toApi(isOwnAccount = false): apiAccount {
        const user = this.data;
        return {
            id: user.id,
            username: user.username,
            display_name: user.displayName,
            note: user.note,
            url:
                user.uri ||
                new URL(`/@${user.username}`, config.http.base_url).toString(),
            avatar: proxyUrl(this.getAvatarUrl(config)) ?? "",
            header: proxyUrl(this.getHeaderUrl(config)) ?? "",
            locked: user.isLocked,
            created_at: new Date(user.createdAt).toISOString(),
            followers_count: user.followerCount,
            following_count: user.followingCount,
            statuses_count: user.statusCount,
            emojis: user.emojis.map((emoji) => emojiToApi(emoji)),
            fields: user.fields.map((field) => ({
                name: htmlToText(getBestContentType(field.key).content),
                value: getBestContentType(field.value).content,
            })),
            bot: user.isBot,
            source: isOwnAccount ? user.source : undefined,
            // TODO: Add static avatar and header
            avatar_static: proxyUrl(this.getAvatarUrl(config)) ?? "",
            header_static: proxyUrl(this.getHeaderUrl(config)) ?? "",
            acct: this.getAcct(),
            // TODO: Add these fields
            limited: false,
            moved: null,
            noindex: false,
            suspended: false,
            discoverable: undefined,
            mute_expires_at: undefined,
            roles: user.roles
                .map((role) => new Role(role))
                .concat(
                    new Role({
                        id: "default",
                        name: "Default",
                        permissions: config.permissions.default,
                        priority: 0,
                        description: "Default role for all users",
                        visible: false,
                        icon: null,
                    }),
                )
                .concat(
                    user.isAdmin
                        ? [
                              new Role({
                                  id: "admin",
                                  name: "Admin",
                                  permissions: config.permissions.admin,
                                  priority: 2 ** 31 - 1,
                                  description:
                                      "Default role for all administrators",
                                  visible: false,
                                  icon: null,
                              }),
                          ]
                        : [],
                )
                .map((r) => r.toApi()),
            group: false,
        };
    }

    toLysand(): typeof EntityValidator.$User {
        if (this.isRemote()) {
            throw new Error("Cannot convert remote user to Lysand format");
        }

        const user = this.data;

        return {
            id: user.id,
            type: "User",
            uri: this.getUri(),
            bio: {
                "text/html": {
                    content: user.note,
                },
                "text/plain": {
                    content: htmlToText(user.note),
                },
            },
            created_at: new Date(user.createdAt).toISOString(),
            dislikes: new URL(
                `/users/${user.id}/dislikes`,
                config.http.base_url,
            ).toString(),
            featured: new URL(
                `/users/${user.id}/featured`,
                config.http.base_url,
            ).toString(),
            likes: new URL(
                `/users/${user.id}/likes`,
                config.http.base_url,
            ).toString(),
            followers: new URL(
                `/users/${user.id}/followers`,
                config.http.base_url,
            ).toString(),
            following: new URL(
                `/users/${user.id}/following`,
                config.http.base_url,
            ).toString(),
            inbox: new URL(
                `/users/${user.id}/inbox`,
                config.http.base_url,
            ).toString(),
            outbox: new URL(
                `/users/${user.id}/outbox`,
                config.http.base_url,
            ).toString(),
            indexable: false,
            username: user.username,
            avatar: urlToContentFormat(this.getAvatarUrl(config)) ?? undefined,
            header: urlToContentFormat(this.getHeaderUrl(config)) ?? undefined,
            display_name: user.displayName,
            fields: user.fields,
            public_key: {
                actor: new URL(
                    `/users/${user.id}`,
                    config.http.base_url,
                ).toString(),
                public_key: user.publicKey,
            },
            extensions: {
                "org.lysand:custom_emojis": {
                    emojis: user.emojis.map((emoji) => emojiToLysand(emoji)),
                },
            },
        };
    }

    toMention(): apiMention {
        return {
            url: this.getUri(),
            username: this.data.username,
            acct: this.getAcct(),
            id: this.id,
        };
    }
}
