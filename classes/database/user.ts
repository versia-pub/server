import { getLogger } from "@logtape/logtape";
import type {
    Account,
    Mention as MentionSchema,
    Source,
} from "@versia/client/schemas";
import type { RolePermission } from "@versia/client/schemas";
import { db, Media, Notification, PushSubscription } from "@versia/kit/db";
import {
    EmojiToUser,
    Likes,
    Notes,
    NoteToMentions,
    Notifications,
    Users,
    UserToPinnedNotes,
} from "@versia/kit/tables";
import { randomUUIDv7 } from "bun";
import { password as bunPassword } from "bun";
import chalk from "chalk";
import {
    and,
    countDistinct,
    desc,
    eq,
    gte,
    type InferInsertModel,
    type InferSelectModel,
    inArray,
    isNotNull,
    isNull,
    type SQL,
    sql,
} from "drizzle-orm";
import { htmlToText } from "html-to-text";
import type { z } from "zod";
import { idValidator } from "@/api";
import { getBestContentType } from "@/content_types";
import { randomString } from "@/math";
import { sentry } from "@/sentry";
import { findManyUsers } from "~/classes/functions/user";
import { searchManager } from "~/classes/search/search-manager";
import { config } from "~/config.ts";
import { sign } from "~/packages/sdk/crypto.ts";
import * as VersiaEntities from "~/packages/sdk/entities/index.ts";
import { FederationRequester } from "~/packages/sdk/http.ts";
import type { ImageContentFormatSchema } from "~/packages/sdk/schemas/index.ts";
import type { HttpVerb, KnownEntity } from "~/types/api.ts";
import { ProxiableUrl } from "../media/url.ts";
import { DeliveryJobType, deliveryQueue } from "../queues/delivery.ts";
import { PushJobType, pushQueue } from "../queues/push.ts";
import { BaseInterface } from "./base.ts";
import { Emoji } from "./emoji.ts";
import { Instance } from "./instance.ts";
import { Like } from "./like.ts";
import type { Note } from "./note.ts";
import { Relationship } from "./relationship.ts";
import { Role } from "./role.ts";

type UserWithInstance = InferSelectModel<typeof Users> & {
    instance: typeof Instance.$type | null;
};

type UserWithRelations = UserWithInstance & {
    emojis: (typeof Emoji.$type)[];
    avatar: typeof Media.$type | null;
    header: typeof Media.$type | null;
    followerCount: number;
    followingCount: number;
    statusCount: number;
    roles: (typeof Role.$type)[];
};

/**
 * Gives helpers to fetch users from database in a nice format
 */
export class User extends BaseInterface<typeof Users, UserWithRelations> {
    public static $type: UserWithRelations;

    public avatar: Media | null;
    public header: Media | null;

    public constructor(data: UserWithRelations) {
        super(data);

        this.avatar = data.avatar ? new Media(data.avatar) : null;
        this.header = data.header ? new Media(data.header) : null;
    }

    public async reload(): Promise<void> {
        const reloaded = await User.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload user");
        }

        this.data = reloaded.data;
        this.avatar = reloaded.avatar;
        this.header = reloaded.header;
    }

    public static async fromId(id: string | null): Promise<User | null> {
        if (!id) {
            return null;
        }

        return await User.fromSql(eq(Users.id, id));
    }

    public static async fromIds(ids: string[]): Promise<User[]> {
        return await User.manyFromSql(inArray(Users.id, ids));
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Users.id),
    ): Promise<User | null> {
        const found = await findManyUsers({
            where: sql,
            orderBy,
        });

        if (!found[0]) {
            return null;
        }
        return new User(found[0]);
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Users.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Users.findMany>[0],
    ): Promise<User[]> {
        const found = await findManyUsers({
            where: sql,
            orderBy,
            limit,
            offset,
            with: extra?.with,
        });

        return found.map((s) => new User(s));
    }

    public get id(): string {
        return this.data.id;
    }

    public get local(): boolean {
        return this.data.instanceId === null;
    }

    public get remote(): boolean {
        return !this.local;
    }

    public get uri(): URL {
        return this.data.uri
            ? new URL(this.data.uri)
            : new URL(`/users/${this.data.id}`, config.http.base_url);
    }

    public static getUri(id: string, uri: URL | null): URL {
        return uri ? uri : new URL(`/users/${id}`, config.http.base_url);
    }

    public hasPermission(permission: RolePermission): boolean {
        return this.getAllPermissions().includes(permission);
    }

    public getAllPermissions(): RolePermission[] {
        return Array.from(
            new Set([
                ...this.data.roles.flatMap((role) => role.permissions),
                // Add default permissions
                ...config.permissions.default,
                // If admin, add admin permissions
                ...(this.data.isAdmin ? config.permissions.admin : []),
            ]),
        );
    }

    public async followRequest(
        otherUser: User,
        options?: {
            reblogs?: boolean;
            notify?: boolean;
            languages?: string[];
        },
    ): Promise<Relationship> {
        const foundRelationship = await Relationship.fromOwnerAndSubject(
            this,
            otherUser,
        );

        await foundRelationship.update({
            following: otherUser.remote ? false : !otherUser.data.isLocked,
            requested: otherUser.remote ? true : otherUser.data.isLocked,
            showingReblogs: options?.reblogs,
            notifying: options?.notify,
            languages: options?.languages,
        });

        if (otherUser.remote) {
            await deliveryQueue.add(DeliveryJobType.FederateEntity, {
                entity: {
                    type: "Follow",
                    id: crypto.randomUUID(),
                    author: this.uri.href,
                    followee: otherUser.uri.href,
                    created_at: new Date().toISOString(),
                },
                recipientId: otherUser.id,
                senderId: this.id,
            });
        } else {
            await otherUser.notify(
                otherUser.data.isLocked ? "follow_request" : "follow",
                this,
            );
        }

        return foundRelationship;
    }

    public async unfollow(
        followee: User,
        relationship: Relationship,
    ): Promise<void> {
        if (followee.remote) {
            await deliveryQueue.add(DeliveryJobType.FederateEntity, {
                entity: this.unfollowToVersia(followee).toJSON(),
                recipientId: followee.id,
                senderId: this.id,
            });
        }

        await relationship.update({
            following: false,
        });
    }

    private unfollowToVersia(followee: User): VersiaEntities.Unfollow {
        const id = crypto.randomUUID();
        return new VersiaEntities.Unfollow({
            type: "Unfollow",
            id,
            author: this.uri,
            created_at: new Date().toISOString(),
            followee: followee.uri,
        });
    }

    public async acceptFollowRequest(follower: User): Promise<void> {
        if (!follower.remote) {
            throw new Error("Follower must be a remote user");
        }

        if (this.remote) {
            throw new Error("Followee must be a local user");
        }

        const entity = new VersiaEntities.FollowAccept({
            type: "FollowAccept",
            id: crypto.randomUUID(),
            author: this.uri,
            created_at: new Date().toISOString(),
            follower: follower.uri,
        });

        await deliveryQueue.add(DeliveryJobType.FederateEntity, {
            entity: entity.toJSON(),
            recipientId: follower.id,
            senderId: this.id,
        });
    }

    public async rejectFollowRequest(follower: User): Promise<void> {
        if (!follower.remote) {
            throw new Error("Follower must be a remote user");
        }

        if (this.remote) {
            throw new Error("Followee must be a local user");
        }

        const entity = new VersiaEntities.FollowReject({
            type: "FollowReject",
            id: crypto.randomUUID(),
            author: this.uri,
            created_at: new Date().toISOString(),
            follower: follower.uri,
        });

        await deliveryQueue.add(DeliveryJobType.FederateEntity, {
            entity: entity.toJSON(),
            recipientId: follower.id,
            senderId: this.id,
        });
    }

    /**
     * Signs a Versia entity with that user's private key
     *
     * @param entity Entity to sign
     * @param signatureUrl URL to embed in signature (must be the same URI of queries made with this signature)
     * @param signatureMethod HTTP method to embed in signature (default: POST)
     * @returns The signed string and headers to send with the request
     */
    public async sign(
        entity: KnownEntity | VersiaEntities.Collection,
        signatureUrl: URL,
        signatureMethod: HttpVerb = "POST",
    ): Promise<{
        headers: Headers;
    }> {
        const privateKey = await crypto.subtle.importKey(
            "pkcs8",
            Buffer.from(this.data.privateKey ?? "", "base64"),
            "Ed25519",
            false,
            ["sign"],
        );

        const { headers } = await sign(
            privateKey,
            this.uri,
            new Request(signatureUrl, {
                method: signatureMethod,
                body: JSON.stringify(entity),
            }),
        );

        return { headers };
    }

    /**
     * Perform a WebFinger lookup to find a user's URI
     * @param username
     * @param hostname
     * @returns URI, or null if not found
     */
    public static webFinger(
        username: string,
        hostname: string,
    ): Promise<URL | null> {
        try {
            return FederationRequester.resolveWebFinger(username, hostname);
        } catch {
            try {
                return FederationRequester.resolveWebFinger(
                    username,
                    hostname,
                    "application/activity+json",
                );
            } catch {
                return Promise.resolve(null);
            }
        }
    }

    public static getCount(): Promise<number> {
        return db.$count(Users, isNull(Users.instanceId));
    }

    public static async getActiveInPeriod(
        milliseconds: number,
    ): Promise<number> {
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

    public async delete(ids?: string[]): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Users).where(inArray(Users.id, ids));
        } else {
            await db.delete(Users).where(eq(Users.id, this.id));
        }
    }

    public async resetPassword(): Promise<string> {
        const resetToken = randomString(32, "hex");

        await this.update({
            passwordResetToken: resetToken,
        });

        return resetToken;
    }

    public async pin(note: Note): Promise<void> {
        await db.insert(UserToPinnedNotes).values({
            noteId: note.id,
            userId: this.id,
        });
    }

    public async unpin(note: Note): Promise<void> {
        await db
            .delete(UserToPinnedNotes)
            .where(
                and(
                    eq(NoteToMentions.noteId, note.id),
                    eq(NoteToMentions.userId, this.id),
                ),
            );
    }

    public save(): Promise<UserWithRelations> {
        return this.update(this.data);
    }

    public async getLinkedOidcAccounts(
        providers: {
            id: string;
            name: string;
            url: string;
            icon?: ProxiableUrl;
        }[],
    ): Promise<
        {
            id: string;
            name: string;
            url: string;
            icon?: string | undefined;
            server_id: string;
        }[]
    > {
        // Get all linked accounts
        const accounts = await db.query.OpenIdAccounts.findMany({
            where: (User, { eq }): SQL | undefined => eq(User.userId, this.id),
        });

        return accounts
            .map((account) => {
                const issuer = providers.find(
                    (provider) => provider.id === account.issuerId,
                );

                if (!issuer) {
                    return null;
                }

                return {
                    id: issuer.id,
                    name: issuer.name,
                    url: issuer.url,
                    icon: issuer.icon?.proxied,
                    server_id: account.serverId,
                };
            })
            .filter((x) => x !== null);
    }

    /**
     * Like a note.
     *
     * If the note is already liked, it will return the existing like. Also creates a notification for the author of the note.
     * @param note The note to like
     * @param uri The URI of the like, if it is remote
     * @returns The like object created or the existing like
     */
    public async like(note: Note, uri?: URL): Promise<Like> {
        // Check if the user has already liked the note
        const existingLike = await Like.fromSql(
            and(eq(Likes.likerId, this.id), eq(Likes.likedId, note.id)),
        );

        if (existingLike) {
            return existingLike;
        }

        const newLike = await Like.insert({
            id: randomUUIDv7(),
            likerId: this.id,
            likedId: note.id,
            uri: uri?.href,
        });

        if (this.local && note.author.local) {
            // Notify the user that their post has been favourited
            await note.author.notify("favourite", this, note);
        } else if (this.local && note.author.remote) {
            // Federate the like
            this.federateToFollowers(newLike.toVersia());
        }

        return newLike;
    }

    /**
     * Unlike a note.
     *
     * If the note is not liked, it will return without doing anything. Also removes any notifications for this like.
     * @param note The note to unlike
     * @returns
     */
    public async unlike(note: Note): Promise<void> {
        const likeToDelete = await Like.fromSql(
            and(eq(Likes.likerId, this.id), eq(Likes.likedId, note.id)),
        );

        if (!likeToDelete) {
            return;
        }

        await likeToDelete.delete();

        if (this.local && note.author.local) {
            // Remove any eventual notifications for this like
            await likeToDelete.clearRelatedNotifications();
        } else if (this.local && note.author.remote) {
            // User is local, federate the delete
            this.federateToFollowers(likeToDelete.unlikeToVersia(this));
        }
    }

    public async notify(
        type: "mention" | "follow_request" | "follow" | "favourite" | "reblog",
        relatedUser: User,
        note?: Note,
    ): Promise<void> {
        const notification = await Notification.insert({
            id: randomUUIDv7(),
            accountId: relatedUser.id,
            type,
            notifiedId: this.id,
            noteId: note?.id ?? null,
        });

        // Also do push notifications
        if (config.notifications.push) {
            await this.notifyPush(notification.id, type, relatedUser, note);
        }
    }

    private async notifyPush(
        notificationId: string,
        type: "mention" | "follow_request" | "follow" | "favourite" | "reblog",
        relatedUser: User,
        note?: Note,
    ): Promise<void> {
        // Fetch all push subscriptions
        const ps = await PushSubscription.manyFromUser(this);

        pushQueue.addBulk(
            ps.map((p) => ({
                data: {
                    psId: p.id,
                    type,
                    relatedUserId: relatedUser.id,
                    noteId: note?.id,
                    notificationId,
                },
                name: PushJobType.Notify,
            })),
        );
    }

    public async clearAllNotifications(): Promise<void> {
        await db
            .update(Notifications)
            .set({
                dismissed: true,
            })
            .where(eq(Notifications.notifiedId, this.id));
    }

    public async clearSomeNotifications(ids: string[]): Promise<void> {
        await db
            .update(Notifications)
            .set({
                dismissed: true,
            })
            .where(
                and(
                    inArray(Notifications.id, ids),
                    eq(Notifications.notifiedId, this.id),
                ),
            );
    }

    /**
     * Change the emojis linked to this user in database
     * @param emojis
     * @returns
     */
    public async updateEmojis(emojis: Emoji[]): Promise<void> {
        if (emojis.length === 0) {
            return;
        }

        await db.delete(EmojiToUser).where(eq(EmojiToUser.userId, this.id));
        await db.insert(EmojiToUser).values(
            emojis.map((emoji) => ({
                emojiId: emoji.id,
                userId: this.id,
            })),
        );
    }

    /**
     * Tries to fetch a Versia user from the given URL.
     *
     * @param url The URL to fetch the user from
     */
    public static async fromVersia(url: URL): Promise<User>;

    /**
     * Takes a Versia User representation, and serializes it to the database.
     *
     * If the user already exists, it will update it.
     * @param versiaUser
     */
    public static async fromVersia(
        versiaUser: VersiaEntities.User,
    ): Promise<User>;

    public static async fromVersia(
        versiaUser: VersiaEntities.User | URL,
    ): Promise<User> {
        if (versiaUser instanceof URL) {
            let uri = versiaUser;
            const instance = await Instance.resolve(uri);

            if (instance.data.protocol === "activitypub") {
                if (!config.federation.bridge) {
                    throw new Error("ActivityPub bridge is not enabled");
                }

                uri = new URL(
                    `/apbridge/versia/query?${new URLSearchParams({
                        user_url: uri.href,
                    })}`,
                    config.federation.bridge.url,
                );
            }

            const user = await User.federationRequester.fetchEntity(
                uri,
                VersiaEntities.User,
            );

            return User.fromVersia(user);
        }

        const {
            username,
            inbox,
            avatar,
            header,
            display_name,
            fields,
            collections,
            created_at,
            bio,
            public_key,
            uri,
            extensions,
        } = versiaUser.data;
        const instance = await Instance.resolve(versiaUser.data.uri);
        const existingUser = await User.fromSql(
            eq(Users.uri, versiaUser.data.uri.href),
        );

        const user =
            existingUser ??
            (await User.insert({
                username,
                id: randomUUIDv7(),
                publicKey: public_key.key,
                uri: uri.href,
                instanceId: instance.id,
            }));

        // Avatars and headers are stored in a separate table, so we need to update them separately
        let userAvatar: Media | null = null;
        let userHeader: Media | null = null;

        if (avatar) {
            if (user.avatar) {
                userAvatar = new Media(
                    await user.avatar.update({
                        content: avatar,
                    }),
                );
            } else {
                userAvatar = await Media.insert({
                    id: randomUUIDv7(),
                    content: avatar,
                });
            }
        }

        if (header) {
            if (user.header) {
                userHeader = new Media(
                    await user.header.update({
                        content: header,
                    }),
                );
            } else {
                userHeader = await Media.insert({
                    id: randomUUIDv7(),
                    content: header,
                });
            }
        }

        await user.update({
            createdAt: new Date(created_at).toISOString(),
            endpoints: {
                inbox: inbox.href,
                outbox: collections.outbox.href,
                followers: collections.followers.href,
                following: collections.following.href,
                featured: collections.featured.href,
                likes: collections["pub.versia:likes/Likes"]?.href,
                dislikes: collections["pub.versia:likes/Dislikes"]?.href,
            },
            avatarId: userAvatar?.id,
            headerId: userHeader?.id,
            fields: fields ?? [],
            displayName: display_name,
            note: getBestContentType(bio).content,
        });

        // Emojis are stored in a separate table, so we need to update them separately
        const emojis = await Promise.all(
            extensions?.["pub.versia:custom_emojis"]?.emojis.map((e) =>
                Emoji.fromVersia(e, instance),
            ) ?? [],
        );

        await user.updateEmojis(emojis);

        return user;
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

    public static async resolve(uri: URL): Promise<User | null> {
        getLogger(["federation", "resolvers"])
            .debug`Resolving user ${chalk.gray(uri)}`;
        // Check if user not already in database
        const foundUser = await User.fromSql(eq(Users.uri, uri.href));

        if (foundUser) {
            return foundUser;
        }

        // Check if URI is of a local user
        if (uri.origin === config.http.base_url.origin) {
            const uuid = uri.href.match(idValidator);

            if (!uuid?.[0]) {
                throw new Error(
                    `URI ${uri} is of a local user, but it could not be parsed`,
                );
            }

            return await User.fromId(uuid[0]);
        }

        getLogger(["federation", "resolvers"])
            .debug`User not found in database, fetching from remote`;

        return User.fromVersia(uri);
    }

    /**
     * Get the user's avatar in raw URL format
     * @returns The raw URL for the user's avatar
     */
    public getAvatarUrl(): ProxiableUrl {
        if (!this.avatar) {
            return (
                config.defaults.avatar ||
                new ProxiableUrl(
                    `https://api.dicebear.com/8.x/${config.defaults.placeholder_style}/svg?seed=${this.data.username}`,
                )
            );
        }
        return this.avatar?.getUrl();
    }

    public static async generateKeys(): Promise<{
        private_key: string;
        public_key: string;
    }> {
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

    public static async register(
        username: string,
        options?: Partial<{
            email: string;
            password: string;
            avatar: Media;
            isAdmin: boolean;
        }>,
    ): Promise<User> {
        const keys = await User.generateKeys();

        const user = await User.insert({
            id: randomUUIDv7(),
            username,
            displayName: username,
            password: options?.password
                ? await bunPassword.hash(options.password)
                : null,
            email: options?.email,
            note: "",
            avatarId: options?.avatar?.id,
            isAdmin: options?.isAdmin,
            publicKey: keys.public_key,
            fields: [],
            privateKey: keys.private_key,
            updatedAt: new Date().toISOString(),
            source: {
                language: "en",
                note: "",
                privacy: "public",
                sensitive: false,
                fields: [],
            } as z.infer<typeof Source>,
        });

        // Add to search index
        await searchManager.addUser(user);

        return user;
    }

    /**
     * Get the user's header in raw URL format
     * @returns The raw URL for the user's header
     */
    public getHeaderUrl(): ProxiableUrl | null {
        if (!this.header) {
            return config.defaults.header ?? null;
        }

        return this.header.getUrl();
    }

    public getAcct(): string {
        return this.local
            ? this.data.username
            : `${this.data.username}@${this.data.instance?.baseUrl}`;
    }

    public static getAcct(
        isLocal: boolean,
        username: string,
        baseUrl?: string,
    ): string {
        return isLocal ? username : `${username}@${baseUrl}`;
    }

    public async update(
        newUser: Partial<UserWithRelations>,
    ): Promise<UserWithRelations> {
        await db.update(Users).set(newUser).where(eq(Users.id, this.id));

        const updated = await User.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update user");
        }

        // If something important is updated, federate it
        if (
            this.local &&
            (newUser.username ||
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
                newUser.isDiscoverable ||
                newUser.isIndexable)
        ) {
            await this.federateToFollowers(this.toVersia());
        }

        return updated.data;
    }

    public static get federationRequester(): FederationRequester {
        return new FederationRequester(
            config.instance.keys.private,
            config.http.base_url,
        );
    }

    public get federationRequester(): Promise<FederationRequester> {
        return crypto.subtle
            .importKey(
                "pkcs8",
                Buffer.from(this.data.privateKey ?? "", "base64"),
                "Ed25519",
                false,
                ["sign"],
            )
            .then((k) => {
                return new FederationRequester(k, this.uri);
            });
    }

    /**
     * Get all remote followers of the user
     * @returns The remote followers
     */
    private getRemoteFollowers(): Promise<User[]> {
        return User.manyFromSql(
            and(
                sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${this.id} AND "Relationships"."ownerId" = ${Users.id} AND "Relationships"."following" = true)`,
                isNotNull(Users.instanceId),
            ),
        );
    }

    /**
     * Federates an entity to all followers of the user
     *
     * @param entity Entity to federate
     */
    public async federateToFollowers(entity: KnownEntity): Promise<void> {
        // Get followers
        const followers = await this.getRemoteFollowers();

        await deliveryQueue.addBulk(
            followers.map((follower) => ({
                name: DeliveryJobType.FederateEntity,
                data: {
                    entity: entity.toJSON(),
                    type: entity.data.type,
                    recipientId: follower.id,
                    senderId: this.id,
                },
            })),
        );
    }

    /**
     * Federates an entity to any user.
     *
     * @param entity Entity to federate
     * @param user User to federate to
     * @returns Whether the federation was successful
     */
    public async federateToUser(
        entity: KnownEntity,
        user: User,
    ): Promise<{ ok: boolean }> {
        const inbox = user.data.instance?.inbox || user.data.endpoints?.inbox;

        if (!inbox) {
            throw new Error(
                `User ${chalk.gray(user.uri)} does not have an inbox endpoint`,
            );
        }

        try {
            await (await this.federationRequester).postEntity(
                new URL(inbox),
                entity,
            );
        } catch (e) {
            getLogger(["federation", "delivery"]).error`Federating ${chalk.gray(
                entity.data.type,
            )} to ${user.uri} ${chalk.bold.red("failed")}`;
            getLogger(["federation", "delivery"]).error`${e}`;
            sentry?.captureException(e);

            return { ok: false };
        }

        return { ok: true };
    }

    public toApi(isOwnAccount = false): z.infer<typeof Account> {
        const user = this.data;

        return {
            id: user.id,
            username: user.username,
            display_name: user.displayName || user.username,
            note: user.note,
            uri: this.uri.href,
            url:
                user.uri ||
                new URL(`/@${user.username}`, config.http.base_url).href,
            avatar: this.getAvatarUrl().proxied,
            header: this.getHeaderUrl()?.proxied ?? "",
            locked: user.isLocked,
            created_at: new Date(user.createdAt).toISOString(),
            followers_count:
                user.isHidingCollections && !isOwnAccount
                    ? 0
                    : user.followerCount,
            following_count:
                user.isHidingCollections && !isOwnAccount
                    ? 0
                    : user.followingCount,
            statuses_count: user.statusCount,
            emojis: user.emojis.map((emoji) => new Emoji(emoji).toApi()),
            fields: user.fields.map((field) => ({
                name: htmlToText(getBestContentType(field.key).content),
                value: getBestContentType(field.value).content,
                verified_at: null,
            })),
            bot: user.isBot,
            source: isOwnAccount ? (user.source ?? undefined) : undefined,
            // TODO: Add static avatar and header
            avatar_static: this.getAvatarUrl().proxied,
            header_static: this.getHeaderUrl()?.proxied ?? "",
            acct: this.getAcct(),
            // TODO: Add these fields
            limited: false,
            moved: null,
            noindex: !user.isIndexable,
            suspended: false,
            discoverable: user.isDiscoverable,
            mute_expires_at: null,
            roles: user.roles
                .map((role) => new Role(role))
                .concat(Role.defaultRole)
                .concat(user.isAdmin ? Role.adminRole : [])
                .map((r) => r.toApi()),
            group: false,
            // TODO
            last_status_at: null,
        };
    }

    public toVersia(): VersiaEntities.User {
        if (this.remote) {
            throw new Error("Cannot convert remote user to Versia format");
        }

        const user = this.data;

        return new VersiaEntities.User({
            id: user.id,
            type: "User",
            uri: this.uri,
            bio: {
                "text/html": {
                    content: user.note,
                    remote: false,
                },
                "text/plain": {
                    content: htmlToText(user.note),
                    remote: false,
                },
            },
            created_at: new Date(user.createdAt).toISOString(),
            collections: {
                featured: new URL(
                    `/users/${user.id}/featured`,
                    config.http.base_url,
                ),
                "pub.versia:likes/Likes": new URL(
                    `/users/${user.id}/likes`,
                    config.http.base_url,
                ),
                "pub.versia:likes/Dislikes": new URL(
                    `/users/${user.id}/dislikes`,
                    config.http.base_url,
                ),
                followers: new URL(
                    `/users/${user.id}/followers`,
                    config.http.base_url,
                ),
                following: new URL(
                    `/users/${user.id}/following`,
                    config.http.base_url,
                ),
                outbox: new URL(
                    `/users/${user.id}/outbox`,
                    config.http.base_url,
                ),
            },
            inbox: new URL(`/users/${user.id}/inbox`, config.http.base_url),
            indexable: this.data.isIndexable,
            username: user.username,
            manually_approves_followers: this.data.isLocked,
            avatar: this.avatar?.toVersia().data as z.infer<
                typeof ImageContentFormatSchema
            >,
            header: this.header?.toVersia().data as z.infer<
                typeof ImageContentFormatSchema
            >,
            display_name: user.displayName,
            fields: user.fields,
            public_key: {
                actor: new URL(`/users/${user.id}`, config.http.base_url),
                key: user.publicKey,
                algorithm: "ed25519",
            },
            extensions: {
                "pub.versia:custom_emojis": {
                    emojis: user.emojis.map((emoji) =>
                        new Emoji(emoji).toVersia(),
                    ),
                },
            },
        });
    }

    public toMention(): z.infer<typeof MentionSchema> {
        return {
            url: this.uri.href,
            username: this.data.username,
            acct: this.getAcct(),
            id: this.id,
        };
    }
}
