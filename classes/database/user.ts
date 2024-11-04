import { idValidator } from "@/api";
import { getBestContentType, urlToContentFormat } from "@/content_types";
import { randomString } from "@/math";
import { proxyUrl } from "@/response";
import { sentry } from "@/sentry";
import { getLogger } from "@logtape/logtape";
import type {
    Account as ApiAccount,
    Mention as ApiMention,
} from "@versia/client/types";
import {
    EntityValidator,
    FederationRequester,
    type HttpVerb,
    SignatureConstructor,
} from "@versia/federation";
import type {
    Collection,
    Unfollow,
    User as VersiaUser,
} from "@versia/federation/types";
import {
    Emoji,
    Instance,
    Like,
    type Note,
    Notification,
    Relationship,
    Role,
    db,
} from "@versia/kit/db";
import {
    EmojiToUser,
    Likes,
    NoteToMentions,
    Notes,
    Notifications,
    type RolePermissions,
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
import { z } from "zod";
import {
    findManyUsers,
    followAcceptToVersia,
    followRejectToVersia,
    followRequestToVersia,
} from "~/classes/functions/user";
import { searchManager } from "~/classes/search/search-manager";
import { type Config, config } from "~/packages/config-manager";
import type { KnownEntity } from "~/types/api.ts";
import { BaseInterface } from "./base.ts";

type UserWithInstance = InferSelectModel<typeof Users> & {
    instance: typeof Instance.$type | null;
};

type UserWithRelations = UserWithInstance & {
    emojis: (typeof Emoji.$type)[];
    followerCount: number;
    followingCount: number;
    statusCount: number;
    roles: (typeof Role.$type)[];
};

/**
 * Gives helpers to fetch users from database in a nice format
 */
export class User extends BaseInterface<typeof Users, UserWithRelations> {
    public static schema: z.ZodType<ApiAccount> = z.object({
        id: z.string(),
        username: z.string(),
        acct: z.string(),
        display_name: z.string(),
        locked: z.boolean(),
        discoverable: z.boolean().optional(),
        group: z.boolean().nullable(),
        noindex: z.boolean().nullable(),
        suspended: z.boolean().nullable(),
        limited: z.boolean().nullable(),
        created_at: z.string(),
        followers_count: z.number(),
        following_count: z.number(),
        statuses_count: z.number(),
        note: z.string(),
        uri: z.string(),
        url: z.string(),
        avatar: z.string(),
        avatar_static: z.string(),
        header: z.string(),
        header_static: z.string(),
        emojis: z.array(Emoji.schema),
        fields: z.array(
            z.object({
                name: z.string(),
                value: z.string(),
                verified: z.boolean().optional(),
                verified_at: z.string().nullable().optional(),
            }),
        ),
        // FIXME: Use a proper type
        moved: z.lazy(() => User.schema).nullable(),
        bot: z.boolean().nullable(),
        source: z
            .object({
                privacy: z.string().nullable(),
                sensitive: z.boolean().nullable(),
                language: z.string().nullable(),
                note: z.string(),
                fields: z.array(
                    z.object({
                        name: z.string(),
                        value: z.string(),
                    }),
                ),
            })
            .optional(),
        role: z
            .object({
                name: z.string(),
            })
            .optional(),
        roles: z.array(Role.schema),
        mute_expires_at: z.string().optional(),
    });

    public static $type: UserWithRelations;

    public async reload(): Promise<void> {
        const reloaded = await User.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload user");
        }

        this.data = reloaded.data;
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

    public getUri(): string {
        return (
            this.data.uri ||
            new URL(`/users/${this.data.id}`, config.http.base_url).toString()
        );
    }

    public static getUri(
        id: string,
        uri: string | null,
        baseUrl: string,
    ): string {
        return uri || new URL(`/users/${id}`, baseUrl).toString();
    }

    public hasPermission(permission: RolePermissions): boolean {
        return this.getAllPermissions().includes(permission);
    }

    public getAllPermissions(): RolePermissions[] {
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
            const { ok } = await this.federateToUser(
                followRequestToVersia(this, otherUser),
                otherUser,
            );

            if (!ok) {
                await foundRelationship.update({
                    requested: false,
                    following: false,
                });

                return foundRelationship;
            }
        } else {
            await Notification.insert({
                accountId: this.id,
                type: otherUser.data.isLocked ? "follow_request" : "follow",
                notifiedId: otherUser.id,
            });
        }

        return foundRelationship;
    }

    public async unfollow(
        followee: User,
        relationship: Relationship,
    ): Promise<boolean> {
        if (followee.isRemote()) {
            // TODO: This should reschedule for a later time and maybe notify the server admin if it fails too often
            const { ok } = await this.federateToUser(
                this.unfollowToVersia(followee),
                followee,
            );

            if (!ok) {
                return false;
            }
        } else if (!this.data.isLocked) {
            if (relationship.data.following) {
                await Notification.insert({
                    accountId: followee.id,
                    type: "unfollow",
                    notifiedId: this.id,
                });
            } else {
                await Notification.insert({
                    accountId: followee.id,
                    type: "cancel-follow",
                    notifiedId: this.id,
                });
            }
        }

        await relationship.update({
            following: false,
        });

        return true;
    }

    private unfollowToVersia(followee: User): Unfollow {
        const id = crypto.randomUUID();
        return {
            type: "Unfollow",
            id,
            author: this.getUri(),
            created_at: new Date().toISOString(),
            followee: followee.getUri(),
        };
    }

    public async sendFollowAccept(follower: User): Promise<void> {
        await this.federateToUser(
            followAcceptToVersia(follower, this),
            follower,
        );
    }

    public async sendFollowReject(follower: User): Promise<void> {
        await this.federateToUser(
            followRejectToVersia(follower, this),
            follower,
        );
    }

    public static async webFinger(
        manager: FederationRequester,
        username: string,
        hostname: string,
    ): Promise<string> {
        return (
            (await manager.webFinger(username, hostname).catch(() => null)) ??
            (await manager.webFinger(
                username,
                hostname,
                "application/activity+json",
            ))
        );
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
                    icon: proxyUrl(issuer.icon) || undefined,
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
            await Notification.insert({
                accountId: this.id,
                type: "favourite",
                notifiedId: note.author.id,
                noteId: note.id,
            });
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

        const updated = await User.saveFromRemote(this.getUri());

        this.data = updated.data;

        return this;
    }

    public static async saveFromRemote(uri: string): Promise<User> {
        if (!URL.canParse(uri)) {
            throw new Error(`Invalid URI: ${uri}`);
        }

        const instance = await Instance.resolve(uri);

        if (instance.data.protocol === "versia") {
            return await User.saveFromVersia(uri, instance);
        }

        if (instance.data.protocol === "activitypub") {
            if (!config.federation.bridge.enabled) {
                throw new Error("ActivityPub bridge is not enabled");
            }

            const bridgeUri = new URL(
                `/apbridge/lysand/query?${new URLSearchParams({
                    user_url: uri,
                })}`,
                config.federation.bridge.url,
            );

            return await User.saveFromVersia(bridgeUri.toString(), instance);
        }

        throw new Error(`Unsupported protocol: ${instance.data.protocol}`);
    }

    private static async saveFromVersia(
        uri: string,
        instance: Instance,
    ): Promise<User> {
        const requester = await User.getFederationRequester();
        const { data: json } = await requester.get<Partial<VersiaUser>>(uri, {
            // @ts-expect-error Bun extension
            proxy: config.http.proxy.address,
        });

        const validator = new EntityValidator();
        const data = await validator.User(json);

        const user = await User.fromVersia(data, instance);

        const userEmojis =
            data.extensions?.["pub.versia:custom_emojis"]?.emojis ?? [];
        const emojis = await Promise.all(
            userEmojis.map((emoji) => Emoji.fromVersia(emoji, instance.id)),
        );

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

        await searchManager.addUser(finalUser);

        return finalUser;
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
            avatar: user.avatar
                ? Object.entries(user.avatar)[0][1].content
                : "",
            header: user.header
                ? Object.entries(user.header)[0][1].content
                : "",
            displayName: user.display_name ?? "",
            note: getBestContentType(user.bio).content,
            publicKey: user.public_key.key,
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

    public static async resolve(uri: string): Promise<User | null> {
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
    public getAvatarUrl(config: Config): string {
        if (!this.data.avatar) {
            return (
                config.defaults.avatar ||
                `https://api.dicebear.com/8.x/${config.defaults.placeholder_style}/svg?seed=${this.data.username}`
            );
        }
        return this.data.avatar;
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
        avatar?: string;
        header?: string;
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
            throw new Error("Failed to create user");
        }

        // Add to search index
        await searchManager.addUser(finalUser);

        return finalUser;
    }

    /**
     * Get the user's header in raw URL format
     * @param config The config to use
     * @returns The raw URL for the user's header
     */
    public getHeaderUrl(config: Config): string {
        if (!this.data.header) {
            return config.defaults.header || "";
        }
        return this.data.header;
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
        signatureUrl: string | URL,
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
            new URL(signatureUrl),
            JSON.stringify(entity),
        );

        if (config.debug.federation) {
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
    public static async getFederationRequester(): Promise<FederationRequester> {
        const signatureConstructor = await SignatureConstructor.fromStringKey(
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

        for (const follower of followers) {
            await this.federateToUser(entity, follower);
        }
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
        const { headers } = await this.sign(
            entity,
            user.data.endpoints?.inbox ?? "",
        );

        try {
            await new FederationRequester().post(
                user.data.endpoints?.inbox ?? "",
                entity,
                {
                    // @ts-expect-error Bun extension
                    proxy: config.http.proxy.address,
                    headers: {
                        ...headers.toJSON(),
                        "Content-Type": "application/json; charset=utf-8",
                    },
                },
            );
        } catch (e) {
            getLogger("federation")
                .error`Federating ${chalk.gray(entity.type)} to ${user.getUri()} ${chalk.bold.red("failed")}`;
            getLogger("federation").error`${e}`;
            sentry?.captureException(e);

            return { ok: false };
        }

        return { ok: true };
    }

    public toApi(isOwnAccount = false): ApiAccount {
        const user = this.data;
        return {
            id: user.id,
            username: user.username,
            display_name: user.displayName,
            note: user.note,
            uri: this.getUri(),
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
            emojis: user.emojis.map((emoji) => new Emoji(emoji).toApi()),
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

    public toVersia(): VersiaUser {
        if (this.isRemote()) {
            throw new Error("Cannot convert remote user to Versia format");
        }

        const user = this.data;

        return {
            id: user.id,
            type: "User",
            uri: this.getUri(),
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
            avatar: urlToContentFormat(this.getAvatarUrl(config)) ?? undefined,
            header: urlToContentFormat(this.getHeaderUrl(config)) ?? undefined,
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

    public toMention(): ApiMention {
        return {
            url: this.getUri(),
            username: this.data.username,
            acct: this.getAcct(),
            id: this.id,
        };
    }
}
