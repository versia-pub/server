import { idValidator } from "@/api";
import { getBestContentType, urlToContentFormat } from "@/content_types";
import { randomString } from "@/math";
import { proxyUrl } from "@/response";
import { sentry } from "@/sentry";
import { getLogger } from "@logtape/logtape";
import type {
    Account as ApiAccount,
    Mention as ApiMention,
} from "@lysand-org/client/types";
import {
    EntityValidator,
    FederationRequester,
    type HttpVerb,
    SignatureConstructor,
} from "@lysand-org/federation";
import type { Entity, User as LysandUser } from "@lysand-org/federation/types";
import chalk from "chalk";
import {
    type InferInsertModel,
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
    type UserWithRelations,
    findManyUsers,
} from "~/classes/functions/user";
import { searchManager } from "~/classes/search/search-manager";
import { db } from "~/drizzle/db";
import {
    EmojiToUser,
    NoteToMentions,
    Notes,
    type RolePermissions,
    UserToPinnedNotes,
    Users,
} from "~/drizzle/schema";
import { type Config, config } from "~/packages/config-manager";
import { BaseInterface } from "./base";
import { Emoji } from "./emoji";
import { Instance } from "./instance";
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
        const found = await findManyUsers({
            where: sql,
            orderBy,
        });

        if (!found[0]) {
            return null;
        }
        return new User(found[0]);
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

    static getServerActor(): User {
        return new User({
            id: "00000000-0000-0000-0000-000000000000",
            username: "actor",
            avatar: "",
            createdAt: "2024-01-01T00:00:00.000Z",
            displayName: "Server Actor",
            note: "This is a system actor used for server-to-server communication. It is not a real user.",
            updatedAt: "2024-01-01T00:00:00.000Z",
            instanceId: null,
            publicKey: config.instance.keys.public,
            source: {
                fields: [],
                language: null,
                note: "",
                privacy: "public",
                sensitive: false,
            },
            fields: [],
            isAdmin: false,
            isBot: false,
            isLocked: false,
            isDiscoverable: false,
            endpoints: {
                dislikes: "",
                featured: "",
                likes: "",
                followers: "",
                following: "",
                inbox: "",
                outbox: "",
            },
            disableAutomoderation: false,
            email: "",
            emailVerificationToken: "",
            emojis: [],
            followerCount: 0,
            followingCount: 0,
            header: "",
            instance: null,
            password: "",
            passwordResetToken: "",
            privateKey: config.instance.keys.private,
            roles: [],
            sanctions: [],
            statusCount: 0,
            uri: "/users/actor",
        });
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

    static async webFinger(
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
        const resetToken = randomString(32, "hex");

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
            throw new Error(`Invalid URI: ${uri}`);
        }

        const instance = await Instance.resolve(uri);

        if (instance.data.protocol === "lysand") {
            return await User.saveFromLysand(uri, instance);
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

            return await User.saveFromLysand(bridgeUri.toString(), instance);
        }

        throw new Error(`Unsupported protocol: ${instance.data.protocol}`);
    }

    private static async saveFromLysand(
        uri: string,
        instance: Instance,
    ): Promise<User> {
        const requester = await User.getServerActor().getFederationRequester();
        const { data: json } = await requester.get<Partial<LysandUser>>(uri, {
            // @ts-expect-error Bun extension
            proxy: config.http.proxy.address,
        });

        const validator = new EntityValidator();
        const data = await validator.User(json);

        const user = await User.fromLysand(data, instance);

        const userEmojis =
            data.extensions?.["org.lysand:custom_emojis"]?.emojis ?? [];
        const emojis = await Promise.all(
            userEmojis.map((emoji) => Emoji.fromLysand(emoji, instance.id)),
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

    static async fromLysand(
        user: LysandUser,
        instance: Instance,
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
            await this.federateToFollowers(this.toLysand());
        }

        return updated.data;
    }

    /**
     * Signs a Lysand entity with that user's private key
     *
     * @param entity Entity to sign
     * @param signatureUrl URL to embed in signature (must be the same URI of queries made with this signature)
     * @param signatureMethod HTTP method to embed in signature (default: POST)
     * @returns The signed string and headers to send with the request
     */
    async sign(
        entity: Entity,
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
     * Helper to get the appropriate Lysand SDK requester with this user's private key
     *
     * @returns The requester
     */
    async getFederationRequester(): Promise<FederationRequester> {
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
    async federateToFollowers(entity: Entity): Promise<void> {
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
    async federateToUser(entity: Entity, user: User): Promise<{ ok: boolean }> {
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
                    headers,
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

    toApi(isOwnAccount = false): ApiAccount {
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

    toLysand(): LysandUser {
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
                    emojis: user.emojis.map((emoji) =>
                        new Emoji(emoji).toLysand(),
                    ),
                },
            },
        };
    }

    toMention(): ApiMention {
        return {
            url: this.getUri(),
            username: this.data.username,
            acct: this.getAcct(),
            id: this.id,
        };
    }
}
