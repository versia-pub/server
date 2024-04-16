import { getBestContentType, urlToContentFormat } from "@content_types";
import { dualLogger } from "@loggers";
import { addUserToMeilisearch } from "@meilisearch";
import { type Config, config } from "config-manager";
import { type InferSelectModel, and, eq, sql } from "drizzle-orm";
import { htmlToText } from "html-to-text";
import type * as Lysand from "lysand-types";
import { db } from "~drizzle/db";
import {
    application,
    emojiToUser,
    instance,
    notification,
    relationship,
    token,
    user,
} from "~drizzle/schema";
import { LogLevel } from "~packages/log-manager";
import type { Account as APIAccount } from "~types/mastodon/account";
import type { Source as APISource } from "~types/mastodon/source";
import {
    type EmojiWithInstance,
    emojiToAPI,
    emojiToLysand,
    fetchEmoji,
} from "./Emoji";
import { objectToInboxRequest } from "./Federation";
import { addInstanceIfNotExists } from "./Instance";
import { createNewRelationship } from "./Relationship";
import type { Token } from "./Token";
import type { Application } from "./Application";

export type User = InferSelectModel<typeof user> & {
    endpoints?: Partial<{
        dislikes: string;
        featured: string;
        likes: string;
        followers: string;
        following: string;
        inbox: string;
        outbox: string;
    }>;
};

export type UserWithRelations = User & {
    instance: InferSelectModel<typeof instance> | null;
    emojis: EmojiWithInstance[];
    followerCount: number;
    followingCount: number;
    statusCount: number;
};

export type UserWithRelationsAndRelationships = UserWithRelations & {
    relationships: InferSelectModel<typeof relationship>[];
    relationshipSubjects: InferSelectModel<typeof relationship>[];
};

export const userRelations: {
    instance: true;
    emojis: {
        with: {
            emoji: {
                with: {
                    instance: true;
                };
            };
        };
    };
} = {
    instance: true,
    emojis: {
        with: {
            emoji: {
                with: {
                    instance: true,
                },
            },
        },
    },
};

export const userExtras = {
    followerCount:
        sql`(SELECT COUNT(*) FROM "Relationship" "relationships" WHERE ("relationships"."ownerId" = "user".id AND "relationships"."following" = true))`.as(
            "follower_count",
        ),
    followingCount:
        sql`(SELECT COUNT(*) FROM "Relationship" "relationshipSubjects" WHERE ("relationshipSubjects"."subjectId" = "user".id AND "relationshipSubjects"."following" = true))`.as(
            "following_count",
        ),
    statusCount:
        sql`(SELECT COUNT(*) FROM "Status" "statuses" WHERE "statuses"."authorId" = "user".id)`.as(
            "status_count",
        ),
};

export const userExtrasTemplate = (name: string) => ({
    // @ts-ignore
    followerCount: sql([
        `(SELECT COUNT(*) FROM "Relationship" "relationships" WHERE ("relationships"."ownerId" = "${name}".id AND "relationships"."following" = true))`,
    ]).as("follower_count"),
    // @ts-ignore
    followingCount: sql([
        `(SELECT COUNT(*) FROM "Relationship" "relationshipSubjects" WHERE ("relationshipSubjects"."subjectId" = "${name}".id AND "relationshipSubjects"."following" = true))`,
    ]).as("following_count"),
    // @ts-ignore
    statusCount: sql([
        `(SELECT COUNT(*) FROM "Status" "statuses" WHERE "statuses"."authorId" = "${name}".id)`,
    ]).as("status_count"),
});

/* const a = await db.query.user.findFirst({
    with: {
        instance: true,
        emojis: {
            with: {
                emoji: {
                    with: {
                        instance: true,
                    },
                },
            },
        },
    },
}); */

export interface AuthData {
    user: UserWithRelations | null;
    token: string;
    application: Application | null;
}

/**
 * Get the user's avatar in raw URL format
 * @param config The config to use
 * @returns The raw URL for the user's avatar
 */
export const getAvatarUrl = (user: User, config: Config) => {
    if (!user.avatar)
        return (
            config.defaults.avatar ||
            `https://api.dicebear.com/8.x/${config.defaults.placeholder_style}/svg?seed=${user.username}`
        );
    return user.avatar;
};

/**
 * Get the user's header in raw URL format
 * @param config The config to use
 * @returns The raw URL for the user's header
 */
export const getHeaderUrl = (user: User, config: Config) => {
    if (!user.header) return config.defaults.header;
    return user.header;
};

export const getFromRequest = async (req: Request): Promise<AuthData> => {
    // Check auth token
    const token = req.headers.get("Authorization")?.split(" ")[1] || "";

    const { user, application } =
        await retrieveUserAndApplicationFromToken(token);

    return { user, token, application };
};

export const followRequestUser = async (
    follower: User,
    followee: User,
    relationshipId: string,
    reblogs = false,
    notify = false,
    languages: string[] = [],
): Promise<InferSelectModel<typeof relationship>> => {
    const isRemote = followee.instanceId !== null;

    const updatedRelationship = (
        await db
            .update(relationship)
            .set({
                following: isRemote ? false : !followee.isLocked,
                requested: isRemote ? true : followee.isLocked,
                showingReblogs: reblogs,
                notifying: notify,
                languages: languages,
            })
            .where(eq(relationship.id, relationshipId))
            .returning()
    )[0];

    if (isRemote) {
        // Federate
        // TODO: Make database job
        const request = await objectToInboxRequest(
            followRequestToLysand(follower, followee),
            follower,
            followee,
        );

        // Send request
        const response = await fetch(request);

        if (!response.ok) {
            dualLogger.log(
                LogLevel.DEBUG,
                "Federation.FollowRequest",
                await response.text(),
            );

            dualLogger.log(
                LogLevel.ERROR,
                "Federation.FollowRequest",
                `Failed to federate follow request from ${follower.id} to ${followee.uri}`,
            );

            return (
                await db
                    .update(relationship)
                    .set({
                        following: false,
                        requested: false,
                    })
                    .where(eq(relationship.id, relationshipId))
                    .returning()
            )[0];
        }
    } else {
        await db.insert(notification).values({
            accountId: follower.id,
            type: followee.isLocked ? "follow_request" : "follow",
            notifiedId: followee.id,
        });
    }

    return updatedRelationship;
};

export const sendFollowAccept = async (follower: User, followee: User) => {
    // TODO: Make database job
    const request = await objectToInboxRequest(
        followAcceptToLysand(follower, followee),
        followee,
        follower,
    );

    // Send request
    const response = await fetch(request);

    if (!response.ok) {
        dualLogger.log(
            LogLevel.DEBUG,
            "Federation.FollowAccept",
            await response.text(),
        );

        dualLogger.log(
            LogLevel.ERROR,
            "Federation.FollowAccept",
            `Failed to federate follow accept from ${followee.id} to ${follower.uri}`,
        );
    }
};

export const sendFollowReject = async (follower: User, followee: User) => {
    // TODO: Make database job
    const request = await objectToInboxRequest(
        followRejectToLysand(follower, followee),
        followee,
        follower,
    );

    // Send request
    const response = await fetch(request);

    if (!response.ok) {
        dualLogger.log(
            LogLevel.DEBUG,
            "Federation.FollowReject",
            await response.text(),
        );

        dualLogger.log(
            LogLevel.ERROR,
            "Federation.FollowReject",
            `Failed to federate follow reject from ${followee.id} to ${follower.uri}`,
        );
    }
};

export const transformOutputToUserWithRelations = (
    user: Omit<User, "endpoints"> & {
        followerCount: unknown;
        followingCount: unknown;
        statusCount: unknown;
        emojis: {
            userId: string;
            emojiId: string;
            emoji?: EmojiWithInstance;
        }[];
        instance: InferSelectModel<typeof instance> | null;
        endpoints: unknown;
    },
): UserWithRelations => {
    return {
        ...user,
        followerCount: Number(user.followerCount),
        followingCount: Number(user.followingCount),
        statusCount: Number(user.statusCount),
        endpoints:
            user.endpoints ??
            ({} as Partial<{
                dislikes: string;
                featured: string;
                likes: string;
                followers: string;
                following: string;
                inbox: string;
                outbox: string;
            }>),
        emojis: user.emojis.map(
            (emoji) =>
                (emoji as unknown as Record<string, object>)
                    .emoji as EmojiWithInstance,
        ),
    };
};

export const findManyUsers = async (
    query: Parameters<typeof db.query.user.findMany>[0],
): Promise<UserWithRelations[]> => {
    const output = await db.query.user.findMany({
        ...query,
        with: {
            ...userRelations,
            ...query?.with,
        },
        extras: {
            ...userExtras,
            ...query?.extras,
        },
    });

    return output.map((user) => transformOutputToUserWithRelations(user));
};

export const findFirstUser = async (
    query: Parameters<typeof db.query.user.findFirst>[0],
): Promise<UserWithRelations | null> => {
    const output = await db.query.user.findFirst({
        ...query,
        with: {
            ...userRelations,
            ...query?.with,
        },
        extras: {
            ...userExtras,
            ...query?.extras,
        },
    });

    if (!output) return null;

    return transformOutputToUserWithRelations(output);
};

export const resolveUser = async (
    uri: string,
): Promise<UserWithRelations | null> => {
    // Check if user not already in database
    const foundUser = await findFirstUser({
        where: (user, { eq }) => eq(user.uri, uri),
    });

    if (foundUser) return foundUser;

    // Check if URI is of a local user
    if (uri.startsWith(config.http.base_url)) {
        const uuid = uri.match(
            /[0-9A-F]{8}-[0-9A-F]{4}-[7][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
        );

        if (!uuid) {
            throw new Error(
                `URI ${uri} is of a local user, but it could not be parsed`,
            );
        }

        const foundLocalUser = await findFirstUser({
            where: (user, { eq }) => eq(user.id, uuid[0]),
        });

        return foundLocalUser || null;
    }

    if (!URL.canParse(uri)) {
        throw new Error(`Invalid URI to parse ${uri}`);
    }

    const response = await fetch(uri, {
        method: "GET",
        headers: {
            Accept: "application/json",
        },
    });

    const data = (await response.json()) as Partial<Lysand.User>;

    if (
        !(
            data.id &&
            data.username &&
            data.uri &&
            data.created_at &&
            data.dislikes &&
            data.featured &&
            data.likes &&
            data.followers &&
            data.following &&
            data.inbox &&
            data.outbox &&
            data.public_key
        )
    ) {
        throw new Error("Invalid user data");
    }

    // Parse emojis and add them to database
    const userEmojis =
        data.extensions?.["org.lysand:custom_emojis"]?.emojis ?? [];

    const instance = await addInstanceIfNotExists(data.uri);

    const emojis = [];

    for (const emoji of userEmojis) {
        emojis.push(await fetchEmoji(emoji));
    }

    const newUser = (
        await db
            .insert(user)
            .values({
                username: data.username,
                uri: data.uri,
                createdAt: new Date(data.created_at).toISOString(),
                endpoints: {
                    dislikes: data.dislikes,
                    featured: data.featured,
                    likes: data.likes,
                    followers: data.followers,
                    following: data.following,
                    inbox: data.inbox,
                    outbox: data.outbox,
                },
                updatedAt: new Date(data.created_at).toISOString(),
                instanceId: instance.id,
                avatar: data.avatar
                    ? Object.entries(data.avatar)[0][1].content
                    : "",
                header: data.header
                    ? Object.entries(data.header)[0][1].content
                    : "",
                displayName: data.display_name ?? "",
                note: getBestContentType(data.bio).content,
                publicKey: data.public_key.public_key,
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

    // Add emojis to user
    if (emojis.length > 0) {
        await db.insert(emojiToUser).values(
            emojis.map((emoji) => ({
                emojiId: emoji.id,
                userId: newUser.id,
            })),
        );
    }

    const finalUser = await findFirstUser({
        where: (user, { eq }) => eq(user.id, newUser.id),
    });

    if (!finalUser) return null;

    // Add to Meilisearch
    await addUserToMeilisearch(finalUser);

    return finalUser;
};

export const getUserUri = (user: User) => {
    return (
        user.uri ||
        new URL(`/users/${user.id}`, config.http.base_url).toString()
    );
};

/**
 * Resolves a WebFinger identifier to a user.
 * @param identifier Either a UUID or a username
 */
export const resolveWebFinger = async (
    identifier: string,
    host: string,
): Promise<UserWithRelations | null> => {
    // Check if user not already in database
    const foundUser = await db
        .select()
        .from(user)
        .innerJoin(instance, eq(user.instanceId, instance.id))
        .where(and(eq(user.username, identifier), eq(instance.baseUrl, host)))
        .limit(1);

    if (foundUser[0])
        return (
            (await findFirstUser({
                where: (user, { eq }) => eq(user.id, foundUser[0].User.id),
            })) || null
        );

    const hostWithProtocol = host.startsWith("http") ? host : `https://${host}`;

    const response = await fetch(
        new URL(
            `/.well-known/webfinger?${new URLSearchParams({
                resource: `acct:${identifier}@${host}`,
            })}`,
            hostWithProtocol,
        ),
        {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        },
    );

    if (response.status === 404) {
        return null;
    }

    const data = (await response.json()) as {
        subject: string;
        links: {
            rel: string;
            type: string;
            href: string;
        }[];
    };

    if (!data.subject || !data.links) {
        throw new Error(
            "Invalid WebFinger data (missing subject or links from response)",
        );
    }

    const relevantLink = data.links.find((link) => link.rel === "self");

    if (!relevantLink) {
        throw new Error(
            "Invalid WebFinger data (missing link with rel: 'self')",
        );
    }

    return resolveUser(relevantLink.href);
};

/**
 * Fetches the list of followers associated with the actor and updates the user's followers
 */
export const fetchFollowers = () => {
    //
};

/**
 * Creates a new LOCAL user.
 * @param data The data for the new user.
 * @returns The newly created user.
 */
export const createNewLocalUser = async (data: {
    username: string;
    display_name?: string;
    password: string;
    email: string;
    bio?: string;
    avatar?: string;
    header?: string;
    admin?: boolean;
    skipPasswordHash?: boolean;
}): Promise<UserWithRelations | null> => {
    const keys = await generateUserKeys();

    const newUser = (
        await db
            .insert(user)
            .values({
                username: data.username,
                displayName: data.display_name ?? data.username,
                password: data.skipPasswordHash
                    ? data.password
                    : await Bun.password.hash(data.password),
                email: data.email,
                note: data.bio ?? "",
                avatar: data.avatar ?? config.defaults.avatar,
                header: data.header ?? config.defaults.avatar,
                isAdmin: data.admin ?? false,
                publicKey: keys.public_key,
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

    const finalUser = await findFirstUser({
        where: (user, { eq }) => eq(user.id, newUser.id),
    });

    if (!finalUser) return null;

    // Add to Meilisearch
    await addUserToMeilisearch(finalUser);

    return finalUser;
};

/**
 * Parses mentions from a list of URIs
 */
export const parseMentionsUris = async (
    mentions: string[],
): Promise<UserWithRelations[]> => {
    return await findManyUsers({
        where: (user, { inArray }) => inArray(user.uri, mentions),
        with: userRelations,
    });
};

/**
 * Retrieves a user from a token.
 * @param access_token The access token to retrieve the user from.
 * @returns The user associated with the given access token.
 */
export const retrieveUserFromToken = async (
    access_token: string,
): Promise<UserWithRelations | null> => {
    if (!access_token) return null;

    const token = await retrieveToken(access_token);

    if (!token || !token.userId) return null;

    const user = await findFirstUser({
        where: (user, { eq }) => eq(user.id, token.userId ?? ""),
    });

    return user;
};

export const retrieveUserAndApplicationFromToken = async (
    access_token: string,
): Promise<{
    user: UserWithRelations | null;
    application: Application | null;
}> => {
    if (!access_token) return { user: null, application: null };

    const output = (
        await db
            .select({
                token: token,
                application: application,
            })
            .from(token)
            .leftJoin(application, eq(token.applicationId, application.id))
            .where(eq(token.accessToken, access_token))
            .limit(1)
    )[0];

    if (!output?.token.userId) return { user: null, application: null };

    const user = await findFirstUser({
        where: (user, { eq }) => eq(user.id, output.token.userId ?? ""),
    });

    return { user, application: output.application ?? null };
};

export const retrieveToken = async (
    access_token: string,
): Promise<Token | null> => {
    if (!access_token) return null;

    return (
        (await db.query.token.findFirst({
            where: (tokens, { eq }) => eq(tokens.accessToken, access_token),
        })) ?? null
    );
};

/**
 * Gets the relationship to another user.
 * @param other The other user to get the relationship to.
 * @returns The relationship to the other user.
 */
export const getRelationshipToOtherUser = async (
    user: UserWithRelations,
    other: User,
): Promise<InferSelectModel<typeof relationship>> => {
    const foundRelationship = await db.query.relationship.findFirst({
        where: (relationship, { and, eq }) =>
            and(
                eq(relationship.ownerId, user.id),
                eq(relationship.subjectId, other.id),
            ),
    });

    if (!foundRelationship) {
        // Create new relationship

        const newRelationship = await createNewRelationship(user, other);

        return newRelationship;
    }

    return foundRelationship;
};

/**
 * Generates keys for the user.
 */
export const generateUserKeys = async () => {
    const keys = await crypto.subtle.generateKey("Ed25519", true, [
        "sign",
        "verify",
    ]);

    const privateKey = btoa(
        String.fromCharCode.apply(null, [
            ...new Uint8Array(
                // jesus help me what do these letters mean
                await crypto.subtle.exportKey("pkcs8", keys.privateKey),
            ),
        ]),
    );
    const publicKey = btoa(
        String.fromCharCode(
            ...new Uint8Array(
                // why is exporting a key so hard
                await crypto.subtle.exportKey("spki", keys.publicKey),
            ),
        ),
    );

    // Add header, footer and newlines later on
    // These keys are base64 encrypted
    return {
        private_key: privateKey,
        public_key: publicKey,
    };
};

export const userToAPI = (
    userToConvert: UserWithRelations,
    isOwnAccount = false,
): APIAccount => {
    return {
        id: userToConvert.id,
        username: userToConvert.username,
        display_name: userToConvert.displayName,
        note: userToConvert.note,
        url:
            userToConvert.uri ||
            new URL(
                `/@${userToConvert.username}`,
                config.http.base_url,
            ).toString(),
        avatar: getAvatarUrl(userToConvert, config),
        header: getHeaderUrl(userToConvert, config),
        locked: userToConvert.isLocked,
        created_at: new Date(userToConvert.createdAt).toISOString(),
        followers_count: userToConvert.followerCount,
        following_count: userToConvert.followingCount,
        statuses_count: userToConvert.statusCount,
        emojis: userToConvert.emojis.map((emoji) => emojiToAPI(emoji)),
        // TODO: Add fields
        fields: [],
        bot: userToConvert.isBot,
        source:
            isOwnAccount && userToConvert.source
                ? (userToConvert.source as APISource)
                : undefined,
        // TODO: Add static avatar and header
        avatar_static: getAvatarUrl(userToConvert, config),
        header_static: getHeaderUrl(userToConvert, config),
        acct:
            userToConvert.instance === null
                ? userToConvert.username
                : `${userToConvert.username}@${userToConvert.instance.baseUrl}`,
        // TODO: Add these fields
        limited: false,
        moved: null,
        noindex: false,
        suspended: false,
        discoverable: undefined,
        mute_expires_at: undefined,
        group: false,
        // @ts-expect-error Pleroma extension
        pleroma: {
            is_admin: userToConvert.isAdmin,
            is_moderator: userToConvert.isAdmin,
        },
    };
};

/**
 * Should only return local users
 */
export const userToLysand = (user: UserWithRelations): Lysand.User => {
    if (user.instanceId !== null) {
        throw new Error("Cannot convert remote user to Lysand format");
    }

    return {
        id: user.id,
        type: "User",
        uri: getUserUri(user),
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
        avatar: urlToContentFormat(getAvatarUrl(user, config)) ?? undefined,
        header: urlToContentFormat(getHeaderUrl(user, config)) ?? undefined,
        display_name: user.displayName,
        fields: (user.source as APISource).fields.map((field) => ({
            key: {
                "text/html": {
                    content: field.name,
                },
                "text/plain": {
                    content: htmlToText(field.name),
                },
            },
            value: {
                "text/html": {
                    content: field.value,
                },
                "text/plain": {
                    content: htmlToText(field.value),
                },
            },
        })),
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
};

export const followRequestToLysand = (
    follower: User,
    followee: User,
): Lysand.Follow => {
    if (follower.instanceId) {
        throw new Error("Follower must be a local user");
    }

    if (!followee.instanceId) {
        throw new Error("Followee must be a remote user");
    }

    if (!followee.uri) {
        throw new Error("Followee must have a URI in database");
    }

    const id = crypto.randomUUID();

    return {
        type: "Follow",
        id: id,
        author: getUserUri(follower),
        followee: followee.uri,
        created_at: new Date().toISOString(),
        uri: new URL(`/follows/${id}`, config.http.base_url).toString(),
    };
};

export const followAcceptToLysand = (
    follower: User,
    followee: User,
): Lysand.FollowAccept => {
    if (!follower.instanceId) {
        throw new Error("Follower must be a remote user");
    }

    if (followee.instanceId) {
        throw new Error("Followee must be a local user");
    }

    if (!follower.uri) {
        throw new Error("Follower must have a URI in database");
    }

    const id = crypto.randomUUID();

    return {
        type: "FollowAccept",
        id: id,
        author: getUserUri(followee),
        created_at: new Date().toISOString(),
        follower: follower.uri,
        uri: new URL(`/follows/${id}`, config.http.base_url).toString(),
    };
};

export const followRejectToLysand = (
    follower: User,
    followee: User,
): Lysand.FollowReject => {
    return {
        ...followAcceptToLysand(follower, followee),
        type: "FollowReject",
    };
};
