import { addUserToMeilisearch } from "@meilisearch";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { type Config, config } from "config-manager";
import { htmlToText } from "html-to-text";
import { client } from "~database/datasource";
import type { APIAccount } from "~types/entities/account";
import type { APISource } from "~types/entities/source";
import type * as Lysand from "lysand-types";
import { addEmojiIfNotExists, emojiToAPI, emojiToLysand } from "./Emoji";
import { addInstanceIfNotExists } from "./Instance";
import { userRelations } from "./relations";
import { createNewRelationship } from "./Relationship";
import { getBestContentType, urlToContentFormat } from "@content_types";
import { objectToInboxRequest } from "./Federation";

export interface AuthData {
    user: UserWithRelations | null;
    token: string;
}

/**
 * Represents a user in the database.
 * Stores local and remote users
 */

const userRelations2 = Prisma.validator<Prisma.UserDefaultArgs>()({
    include: userRelations,
});

export type UserWithRelations = Prisma.UserGetPayload<typeof userRelations2>;

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

    return { user: await retrieveUserFromToken(token), token };
};

export const followRequestUser = async (
    follower: User,
    followee: User,
    relationshipId: string,
    reblogs = false,
    notify = false,
    languages: string[] = [],
) => {
    const isRemote = follower.instanceId !== followee.instanceId;

    const relationship = await client.relationship.update({
        where: { id: relationshipId },
        data: {
            following: isRemote ? false : !followee.isLocked,
            requested: isRemote ? true : followee.isLocked,
            showingReblogs: reblogs,
            notifying: notify,
            languages: languages,
        },
    });

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
            console.error(await response.text());
            throw new Error(
                `Failed to federate follow request from ${follower.id} to ${followee.uri}`,
            );
        }
    } else {
        if (followee.isLocked) {
            await client.notification.create({
                data: {
                    accountId: follower.id,
                    type: "follow_request",
                    notifiedId: followee.id,
                },
            });
        } else {
            await client.notification.create({
                data: {
                    accountId: follower.id,
                    type: "follow",
                    notifiedId: followee.id,
                },
            });
        }
    }

    return relationship;
};

export const resolveUser = async (uri: string) => {
    // Check if user not already in database
    const foundUser = await client.user.findUnique({
        where: {
            uri,
        },
        include: userRelations,
    });

    if (foundUser) return foundUser;

    const response = await fetch(uri, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
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
        emojis.push(await addEmojiIfNotExists(emoji));
    }

    const user = await client.user.create({
        data: {
            username: data.username,
            uri: data.uri,
            createdAt: new Date(data.created_at),
            endpoints: {
                dislikes: data.dislikes,
                featured: data.featured,
                likes: data.likes,
                followers: data.followers,
                following: data.following,
                inbox: data.inbox,
                outbox: data.outbox,
            },
            emojis: {
                connect: emojis.map((emoji) => ({
                    id: emoji.id,
                })),
            },
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
        },
        include: userRelations,
    });

    // Add to Meilisearch
    await addUserToMeilisearch(user);

    return user;
};

/**
 * Resolves a WebFinger identifier to a user.
 * @param identifier Either a UUID or a username
 */
export const resolveWebFinger = async (identifier: string, host: string) => {
    // Check if user not already in database
    const foundUser = await client.user.findUnique({
        where: {
            username: identifier,
            instance: {
                base_url: host,
            },
        },
        include: userRelations,
    });

    if (foundUser) return foundUser;

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
}) => {
    const keys = await generateUserKeys();

    const user = await client.user.create({
        data: {
            username: data.username,
            displayName: data.display_name ?? data.username,
            password: await Bun.password.hash(data.password),
            email: data.email,
            note: data.bio ?? "",
            avatar: data.avatar ?? config.defaults.avatar,
            header: data.header ?? config.defaults.avatar,
            isAdmin: data.admin ?? false,
            publicKey: keys.public_key,
            privateKey: keys.private_key,
            source: {
                language: null,
                note: "",
                privacy: "public",
                sensitive: false,
                fields: [],
            },
        },
        include: userRelations,
    });

    // Add to Meilisearch
    await addUserToMeilisearch(user);

    return user;
};

/**
 * Parses mentions from a list of URIs
 */
export const parseMentionsUris = async (mentions: string[]) => {
    return await client.user.findMany({
        where: {
            uri: {
                in: mentions,
            },
        },
        include: userRelations,
    });
};

/**
 * Retrieves a user from a token.
 * @param access_token The access token to retrieve the user from.
 * @returns The user associated with the given access token.
 */
export const retrieveUserFromToken = async (access_token: string) => {
    if (!access_token) return null;

    const token = await client.token.findFirst({
        where: {
            access_token,
        },
        include: {
            user: {
                include: userRelations,
            },
        },
    });

    if (!token) return null;

    return token.user;
};

/**
 * Gets the relationship to another user.
 * @param other The other user to get the relationship to.
 * @returns The relationship to the other user.
 */
export const getRelationshipToOtherUser = async (
    user: UserWithRelations,
    other: User,
) => {
    const relationship = await client.relationship.findFirst({
        where: {
            ownerId: user.id,
            subjectId: other.id,
        },
    });

    if (!relationship) {
        // Create new relationship

        const newRelationship = await createNewRelationship(user, other);

        await client.user.update({
            where: { id: user.id },
            data: {
                relationships: {
                    connect: {
                        id: newRelationship.id,
                    },
                },
            },
        });

        return newRelationship;
    }

    return relationship;
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
    user: UserWithRelations,
    isOwnAccount = false,
): APIAccount => {
    return {
        id: user.id,
        username: user.username,
        display_name: user.displayName,
        note: user.note,
        url:
            user.uri ||
            new URL(`/@${user.username}`, config.http.base_url).toString(),
        avatar: getAvatarUrl(user, config),
        header: getHeaderUrl(user, config),
        locked: user.isLocked,
        created_at: new Date(user.createdAt).toISOString(),
        followers_count: user.relationshipSubjects.filter((r) => r.following)
            .length,
        following_count: user.relationships.filter((r) => r.following).length,
        statuses_count: user._count.statuses,
        emojis: user.emojis.map((emoji) => emojiToAPI(emoji)),
        // TODO: Add fields
        fields: [],
        bot: user.isBot,
        source:
            isOwnAccount && user.source
                ? (user.source as APISource)
                : undefined,
        // TODO: Add static avatar and header
        avatar_static: "",
        header_static: "",
        acct:
            user.instance === null
                ? user.username
                : `${user.username}@${user.instance.base_url}`,
        // TODO: Add these fields
        limited: false,
        moved: null,
        noindex: false,
        suspended: false,
        discoverable: undefined,
        mute_expires_at: undefined,
        group: false,
        pleroma: {
            is_admin: user.isAdmin,
            is_moderator: user.isAdmin,
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
        uri:
            user.uri ||
            new URL(`/users/${user.id}`, config.http.base_url).toString(),
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
        author: new URL(
            `/users/${follower.id}`,
            config.http.base_url,
        ).toString(),
        followee: followee.uri,
        created_at: new Date().toISOString(),
        uri: new URL(`/follows/${id}`, config.http.base_url).toString(),
    };
};

export const followAcceptToLysand = (
    follower: User,
    followee: User,
): Lysand.FollowAccept => {
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
        type: "FollowAccept",
        id: id,
        author: new URL(
            `/users/${followee.id}`,
            config.http.base_url,
        ).toString(),
        created_at: new Date().toISOString(),
        follower: new URL(
            `/users/${follower.id}`,
            config.http.base_url,
        ).toString(),
        uri: new URL(`/follows/${id}`, config.http.base_url).toString(),
    };
};
