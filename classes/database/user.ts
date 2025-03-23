import { idValidator } from "@/api";
import { getBestContentType } from "@/content_types";
import { randomString } from "@/math";
import { proxyUrl } from "@/response";
import { sentry } from "@/sentry";
import type { z } from "@hono/zod-openapi";
import { getLogger } from "@logtape/logtape";
import type {
    Account,
    Mention as MentionSchema,
    Source,
} from "@versia/client/schemas";
import type { RolePermission } from "@versia/client/schemas";
import {
    EntityValidator,
    FederationRequester,
    type HttpVerb,
    SignatureConstructor,
} from "@versia/federation";
import type {
    Collection,
    Unfollow,
    FollowAccept as VersiaFollowAccept,
    FollowReject as VersiaFollowReject,
    User as VersiaUser,
} from "@versia/federation/types";
import { Media, Notification, PushSubscription, db } from "@versia/kit/db";
import {
    EmojiToUser,
    Likes,
    NoteToMentions,
    Notes,
    Notifications,
    UserToPinnedNotes,
    Users,
} from "@versia/kit/tables";
import chalk from "chalk";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    and,
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
import { findManyUsers } from "~/classes/functions/user";
import { searchManager } from "~/classes/search/search-manager";
import { config } from "~/config.ts";
import type { KnownEntity } from "~/types/api.ts";
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

    public isLocal(): boolean {
        return this.data.instanceId === null;
    }

    public isRemote(): boolean {
        return !this.isLocal();
    }

    public getUri(): URL {
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
                }, [] as RolePermission[])
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
            following: otherUser.isRemote() ? false : !otherUser.data.isLocked,
            requested: otherUser.isRemote() ? true : otherUser.data.isLocked,
            showingReblogs: options?.reblogs,
            notifying: options?.notify,
            languages: options?.languages,
        });

        if (otherUser.isRemote()) {
            await deliveryQueue.add(DeliveryJobType.FederateEntity, {
                entity: {
                    type: "Follow",
                    id: crypto.randomUUID(),
                    author: this.getUri().toString(),
                    followee: otherUser.getUri().toString(),
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
        if (followee.isRemote()) {
            await deliveryQueue.add(DeliveryJobType.FederateEntity, {
                entity: this.unfollowToVersia(followee),
                recipientId: followee.id,
                senderId: this.id,
            });
        }

        await relationship.update({
            following: false,
        });
    }

    private unfollowToVersia(followee: User): Unfollow {
        const id = crypto.randomUUID();
        return {
            type: "Unfollow",
            id,
            author: this.getUri().toString(),
            created_at: new Date().toISOString(),
            followee: followee.getUri().toString(),
        };
    }

    public async sendFollowAccept(follower: User): Promise<void> {
        if (!follower.isRemote()) {
            throw new Error("Follower must be a remote user");
        }

        if (this.isRemote()) {
            throw new Error("Followee must be a local user");
        }

        const entity: VersiaFollowAccept = {
            type: "FollowAccept",
            id: crypto.randomUUID(),
            author: this.getUri().toString(),
            created_at: new Date().toISOString(),
            follower: follower.getUri().toString(),
        };

        await deliveryQueue.add(DeliveryJobType.FederateEntity, {
            entity,
            recipientId: follower.id,
            senderId: this.id,
        });
    }

    public async sendFollowReject(follower: User): Promise<void> {
        if (!follower.isRemote()) {
            throw new Error("Follower must be a remote user");
        }

        if (this.isRemote()) {
            throw new Error("Followee must be a local user");
        }

        const entity: VersiaFollowReject = {
            type: "FollowReject",
            id: crypto.randomUUID(),
            author: this.getUri().toString(),
            created_at: new Date().toISOString(),
            follower: follower.getUri().toString(),
        };

        await deliveryQueue.add(DeliveryJobType.FederateEntity, {
            entity,
            recipientId: follower.id,
            senderId: this.id,
        });
    }

    /**
     * Perform a WebFinger lookup to find a user's URI
     * @param manager
     * @param username
     * @param hostname
     * @returns URI, or null if not found
     */
    public static async webFinger(
        manager: FederationRequester,
        username: string,
        hostname: string,
    ): Promise<URL | null> {
        try {
            return new URL(await manager.webFinger(username, hostname));
        } catch {
            try {
                return new URL(
                    await manager.webFinger(
                        username,
                        hostname,
                        "application/activity+json",
                    ),
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
            icon?: string;
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
                    icon: issuer.icon
                        ? proxyUrl(new URL(issuer.icon)).toString()
                        : undefined,
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
    public async like(note: Note, uri?: string): Promise<Like> {
        // Check if the user has already liked the note
        const existingLike = await Like.fromSql(
            and(eq(Likes.likerId, this.id), eq(Likes.likedId, note.id)),
        );

        if (existingLike) {
            return existingLike;
        }

        const newLike = await Like.insert({
            likerId: this.id,
            likedId: note.id,
            uri,
        });

        if (this.isLocal() && note.author.isLocal()) {
            // Notify the user that their post has been favourited
            await note.author.notify("favourite", this, note);
        } else if (this.isLocal() && note.author.isRemote()) {
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

        if (this.isLocal() && note.author.isLocal()) {
            // Remove any eventual notifications for this like
            await likeToDelete.clearRelatedNotifications();
        } else if (this.isLocal() && note.author.isRemote()) {
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

    public async updateFromRemote(): Promise<User> {
        if (!this.isRemote()) {
            throw new Error(
                "Cannot refetch a local user (they are not remote)",
            );
        }

        const updated = await User.fetchFromRemote(this.getUri());

        if (!updated) {
            throw new Error("Failed to update user from remote");
        }

        this.data = updated.data;

        return this;
    }

    public static async fetchFromRemote(uri: URL): Promise<User | null> {
        const instance = await Instance.resolve(uri);

        if (!instance) {
            return null;
        }

        if (instance.data.protocol === "versia") {
            return await User.saveFromVersia(uri, instance);
        }

        if (instance.data.protocol === "activitypub") {
            if (!config.federation.bridge) {
                throw new Error("ActivityPub bridge is not enabled");
            }

            const bridgeUri = new URL(
                `/apbridge/versia/query?${new URLSearchParams({
                    user_url: uri.toString(),
                })}`,
                config.federation.bridge.url,
            );

            return await User.saveFromVersia(bridgeUri, instance);
        }

        throw new Error(`Unsupported protocol: ${instance.data.protocol}`);
    }

    private static async saveFromVersia(
        uri: URL,
        instance: Instance,
    ): Promise<User> {
        const requester = await User.getFederationRequester();
        const output = await requester.get<Partial<VersiaUser>>(uri, {
            // @ts-expect-error Bun extension
            proxy: config.http.proxy_address,
        });

        const { data: json } = output;

        const validator = new EntityValidator();
        const data = await validator.User(json);

        const user = await User.fromVersia(data, instance);

        await searchManager.addUser(user);

        return user;
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

    public static async fromVersia(
        user: VersiaUser,
        instance: Instance,
    ): Promise<User> {
        const data = {
            username: user.username,
            uri: user.uri,
            createdAt: new Date(user.created_at).toISOString(),
            endpoints: {
                dislikes:
                    user.collections["pub.versia:likes/Dislikes"] ?? undefined,
                featured: user.collections.featured,
                likes: user.collections["pub.versia:likes/Likes"] ?? undefined,
                followers: user.collections.followers,
                following: user.collections.following,
                inbox: user.inbox,
                outbox: user.collections.outbox,
            },
            fields: user.fields ?? [],
            updatedAt: new Date(user.created_at).toISOString(),
            instanceId: instance.id,
            displayName: user.display_name ?? "",
            note: getBestContentType(user.bio).content,
            publicKey: user.public_key.key,
            source: {
                language: "en",
                note: "",
                privacy: "public",
                sensitive: false,
                fields: [],
            } as z.infer<typeof Source>,
        };

        const userEmojis =
            user.extensions?.["pub.versia:custom_emojis"]?.emojis ?? [];

        const emojis = await Promise.all(
            userEmojis.map((emoji) => Emoji.fromVersia(emoji, instance)),
        );

        // Check if new user already exists
        const foundUser = await User.fromSql(eq(Users.uri, user.uri));

        // If it exists, simply update it
        if (foundUser) {
            let avatar: Media | null = null;
            let header: Media | null = null;

            if (user.avatar) {
                if (foundUser.avatar) {
                    avatar = new Media(
                        await foundUser.avatar.update({
                            content: user.avatar,
                        }),
                    );
                } else {
                    avatar = await Media.insert({
                        content: user.avatar,
                    });
                }
            }

            if (user.header) {
                if (foundUser.header) {
                    header = new Media(
                        await foundUser.header.update({
                            content: user.header,
                        }),
                    );
                } else {
                    header = await Media.insert({
                        content: user.header,
                    });
                }
            }

            await foundUser.update({
                ...data,
                avatarId: avatar?.id,
                headerId: header?.id,
            });
            await foundUser.updateEmojis(emojis);

            return foundUser;
        }

        // Else, create a new user
        const avatar = user.avatar
            ? await Media.insert({
                  content: user.avatar,
              })
            : null;

        const header = user.header
            ? await Media.insert({
                  content: user.header,
              })
            : null;

        const newUser = await User.insert({
            ...data,
            avatarId: avatar?.id,
            headerId: header?.id,
        });
        await newUser.updateEmojis(emojis);

        return newUser;
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
        const foundUser = await User.fromSql(eq(Users.uri, uri.toString()));

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

        return await User.fetchFromRemote(uri);
    }

    /**
     * Get the user's avatar in raw URL format
     * @returns The raw URL for the user's avatar
     */
    public getAvatarUrl(): URL {
        if (!this.avatar) {
            return (
                config.defaults.avatar ||
                new URL(
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

    public static async fromDataLocal(data: {
        username: string;
        display_name?: string;
        password: string | undefined;
        email: string | undefined;
        bio?: string;
        avatar?: Media;
        header?: Media;
        admin?: boolean;
        skipPasswordHash?: boolean;
    }): Promise<User> {
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
                    avatarId: data.avatar?.id,
                    headerId: data.header?.id,
                    isAdmin: data.admin ?? false,
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
                })
                .returning()
        )[0];

        const finalUser = await User.fromId(newUser.id);

        if (!finalUser) {
            throw new Error("Failed to create user");
        }

        // Add to search index
        await searchManager.addUser(finalUser);

        return finalUser;
    }

    /**
     * Get the user's header in raw URL format
     * @returns The raw URL for the user's header
     */
    public getHeaderUrl(): URL | null {
        if (!this.header) {
            return config.defaults.header ?? null;
        }
        return this.header.getUrl();
    }

    public getAcct(): string {
        return this.isLocal()
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
            this.isLocal() &&
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
                newUser.isDiscoverable)
        ) {
            await this.federateToFollowers(this.toVersia());
        }

        return updated.data;
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
        entity: KnownEntity | Collection,
        signatureUrl: URL,
        signatureMethod: HttpVerb = "POST",
    ): Promise<{
        headers: Headers;
        signedString: string;
    }> {
        const signatureConstructor = await SignatureConstructor.fromStringKey(
            this.data.privateKey ?? "",
            this.getUri(),
        );

        const output = await signatureConstructor.sign(
            signatureMethod,
            signatureUrl,
            JSON.stringify(entity),
        );

        if (config.debug?.federation) {
            const logger = getLogger("federation");

            // Log public key
            logger.debug`Sender public key: ${this.data.publicKey}`;

            // Log signed string
            logger.debug`Signed string:\n${output.signedString}`;
        }

        return output;
    }

    /**
     * Helper to get the appropriate Versia SDK requester with the instance's private key
     *
     * @returns The requester
     */
    public static getFederationRequester(): FederationRequester {
        const signatureConstructor = new SignatureConstructor(
            config.instance.keys.private,
            config.http.base_url,
        );

        return new FederationRequester(signatureConstructor);
    }

    /**
     * Helper to get the appropriate Versia SDK requester with this user's private key
     *
     * @returns The requester
     */
    public async getFederationRequester(): Promise<FederationRequester> {
        const signatureConstructor = await SignatureConstructor.fromStringKey(
            this.data.privateKey ?? "",
            this.getUri(),
        );

        return new FederationRequester(signatureConstructor);
    }

    /**
     * Federates an entity to all followers of the user
     *
     * @param entity Entity to federate
     */
    public async federateToFollowers(entity: KnownEntity): Promise<void> {
        // Get followers
        const followers = await User.manyFromSql(
            and(
                sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${this.id} AND "Relationships"."ownerId" = ${Users.id} AND "Relationships"."following" = true)`,
                isNotNull(Users.instanceId),
            ),
        );

        await deliveryQueue.addBulk(
            followers.map((follower) => ({
                name: DeliveryJobType.FederateEntity,
                data: {
                    entity,
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
                `User ${chalk.gray(user.getUri())} does not have an inbox endpoint`,
            );
        }

        const { headers } = await this.sign(entity, new URL(inbox));

        try {
            await new FederationRequester().post(inbox, entity, {
                // @ts-expect-error Bun extension
                proxy: config.http.proxy_address,
                headers: {
                    ...headers.toJSON(),
                    "Content-Type": "application/json; charset=utf-8",
                },
            });
        } catch (e) {
            getLogger(["federation", "delivery"])
                .error`Federating ${chalk.gray(entity.type)} to ${user.getUri()} ${chalk.bold.red("failed")}`;
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
            display_name: user.displayName,
            note: user.note,
            uri: this.getUri().toString(),
            url:
                user.uri ||
                new URL(`/@${user.username}`, config.http.base_url).toString(),
            avatar: proxyUrl(this.getAvatarUrl()).toString(),
            header: this.getHeaderUrl()
                ? proxyUrl(this.getHeaderUrl() as URL).toString()
                : "",
            locked: user.isLocked,
            created_at: new Date(user.createdAt).toISOString(),
            followers_count: user.followerCount,
            following_count: user.followingCount,
            statuses_count: user.statusCount,
            emojis: user.emojis.map((emoji) => new Emoji(emoji).toApi()),
            fields: user.fields.map((field) => ({
                name: htmlToText(getBestContentType(field.key).content),
                value: getBestContentType(field.value).content,
                verified_at: null,
            })),
            bot: user.isBot,
            source: isOwnAccount ? user.source : undefined,
            // TODO: Add static avatar and header
            avatar_static: proxyUrl(this.getAvatarUrl()).toString(),
            header_static: this.getHeaderUrl()
                ? proxyUrl(this.getHeaderUrl() as URL).toString()
                : "",
            acct: this.getAcct(),
            // TODO: Add these fields
            limited: false,
            moved: null,
            noindex: false,
            suspended: false,
            discoverable: user.isDiscoverable,
            mute_expires_at: null,
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
            // TODO
            last_status_at: null,
        };
    }

    public toVersia(): VersiaUser {
        if (this.isRemote()) {
            throw new Error("Cannot convert remote user to Versia format");
        }

        const user = this.data;

        return {
            id: user.id,
            type: "User",
            uri: this.getUri().toString(),
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
                ).toString(),
                "pub.versia:likes/Likes": new URL(
                    `/users/${user.id}/likes`,
                    config.http.base_url,
                ).toString(),
                "pub.versia:likes/Dislikes": new URL(
                    `/users/${user.id}/dislikes`,
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
                outbox: new URL(
                    `/users/${user.id}/outbox`,
                    config.http.base_url,
                ).toString(),
            },
            inbox: new URL(
                `/users/${user.id}/inbox`,
                config.http.base_url,
            ).toString(),
            indexable: false,
            username: user.username,
            manually_approves_followers: this.data.isLocked,
            avatar: this.avatar?.toVersia(),
            header: this.header?.toVersia(),
            display_name: user.displayName,
            fields: user.fields,
            public_key: {
                actor: new URL(
                    `/users/${user.id}`,
                    config.http.base_url,
                ).toString(),
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
        };
    }

    public toMention(): z.infer<typeof MentionSchema> {
        return {
            url: this.getUri().toString(),
            username: this.data.username,
            acct: this.getAcct(),
            id: this.id,
        };
    }
}
