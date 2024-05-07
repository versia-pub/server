import { dualLogger } from "@loggers";
import { addUserToMeilisearch } from "@meilisearch";
import { config } from "config-manager";
import { type InferSelectModel, and, eq, inArray, sql } from "drizzle-orm";
import type * as Lysand from "lysand-types";
import { db } from "~drizzle/db";
import {
    Applications,
    Instances,
    Notifications,
    Relationships,
    Tokens,
    Users,
} from "~drizzle/schema";
import { User } from "~packages/database-interface/user";
import { LogLevel } from "~packages/log-manager";
import type { Application } from "./Application";
import type { EmojiWithInstance } from "./Emoji";
import { objectToInboxRequest } from "./Federation";
import { createNewRelationship } from "./Relationship";
import type { Token } from "./Token";

export type UserType = InferSelectModel<typeof Users>;

export type UserWithInstance = UserType & {
    instance: InferSelectModel<typeof Instances> | null;
};

export type UserWithRelations = UserType & {
    instance: InferSelectModel<typeof Instances> | null;
    emojis: EmojiWithInstance[];
    followerCount: number;
    followingCount: number;
    statusCount: number;
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
        sql`(SELECT COUNT(*) FROM "Relationships" "relationships" WHERE ("relationships"."ownerId" = "Users".id AND "relationships"."following" = true))`.as(
            "follower_count",
        ),
    followingCount:
        sql`(SELECT COUNT(*) FROM "Relationships" "relationshipSubjects" WHERE ("relationshipSubjects"."subjectId" = "Users".id AND "relationshipSubjects"."following" = true))`.as(
            "following_count",
        ),
    statusCount:
        sql`(SELECT COUNT(*) FROM "Notes" WHERE "Notes"."authorId" = "Users".id)`.as(
            "status_count",
        ),
};

export const userExtrasTemplate = (name: string) => ({
    // @ts-ignore
    followerCount: sql([
        `(SELECT COUNT(*) FROM "Relationships" "relationships" WHERE ("relationships"."ownerId" = "${name}".id AND "relationships"."following" = true))`,
    ]).as("follower_count"),
    // @ts-ignore
    followingCount: sql([
        `(SELECT COUNT(*) FROM "Relationships" "relationshipSubjects" WHERE ("relationshipSubjects"."subjectId" = "${name}".id AND "relationshipSubjects"."following" = true))`,
    ]).as("following_count"),
    // @ts-ignore
    statusCount: sql([
        `(SELECT COUNT(*) FROM "Notes" WHERE "Notes"."authorId" = "${name}".id)`,
    ]).as("status_count"),
});

export interface AuthData {
    user: User | null;
    token: string;
    application: Application | null;
}

export const getFromHeader = async (value: string): Promise<AuthData> => {
    const token = value.split(" ")[1];

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
): Promise<InferSelectModel<typeof Relationships>> => {
    const isRemote = followee.isRemote();

    const updatedRelationship = (
        await db
            .update(Relationships)
            .set({
                following: isRemote ? false : !followee.getUser().isLocked,
                requested: isRemote ? true : followee.getUser().isLocked,
                showingReblogs: reblogs,
                notifying: notify,
                languages: languages,
            })
            .where(eq(Relationships.id, relationshipId))
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
                `Failed to federate follow request from ${
                    follower.id
                } to ${followee.getUri()}`,
            );

            return (
                await db
                    .update(Relationships)
                    .set({
                        following: false,
                        requested: false,
                    })
                    .where(eq(Relationships.id, relationshipId))
                    .returning()
            )[0];
        }
    } else {
        await db.insert(Notifications).values({
            accountId: follower.id,
            type: followee.getUser().isLocked ? "follow_request" : "follow",
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
            `Failed to federate follow accept from ${
                followee.id
            } to ${follower.getUri()}`,
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
            `Failed to federate follow reject from ${
                followee.id
            } to ${follower.getUri()}`,
        );
    }
};

export const transformOutputToUserWithRelations = (
    user: Omit<UserType, "endpoints"> & {
        followerCount: unknown;
        followingCount: unknown;
        statusCount: unknown;
        emojis: {
            userId: string;
            emojiId: string;
            emoji?: EmojiWithInstance;
        }[];
        instance: InferSelectModel<typeof Instances> | null;
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
    query: Parameters<typeof db.query.Users.findMany>[0],
): Promise<UserWithRelations[]> => {
    const output = await db.query.Users.findMany({
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
    query: Parameters<typeof db.query.Users.findFirst>[0],
): Promise<UserWithRelations | null> => {
    const output = await db.query.Users.findFirst({
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

/**
 * Resolves a WebFinger identifier to a user.
 * @param identifier Either a UUID or a username
 */
export const resolveWebFinger = async (
    identifier: string,
    host: string,
): Promise<User | null> => {
    // Check if user not already in database
    const foundUser = await db
        .select()
        .from(Users)
        .innerJoin(Instances, eq(Users.instanceId, Instances.id))
        .where(and(eq(Users.username, identifier), eq(Instances.baseUrl, host)))
        .limit(1);

    if (foundUser[0]) return await User.fromId(foundUser[0].Users.id);

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

    return User.resolve(relevantLink.href);
};

/**
 * Retrieves a user from a token.
 * @param access_token The access token to retrieve the user from.
 * @returns The user associated with the given access token.
 */
export const retrieveUserFromToken = async (
    access_token: string,
): Promise<User | null> => {
    if (!access_token) return null;

    const token = await retrieveToken(access_token);

    if (!token || !token.userId) return null;

    const user = await User.fromId(token.userId);

    return user;
};

export const retrieveUserAndApplicationFromToken = async (
    access_token: string,
): Promise<{
    user: User | null;
    application: Application | null;
}> => {
    if (!access_token) return { user: null, application: null };

    const output = (
        await db
            .select({
                token: Tokens,
                application: Applications,
            })
            .from(Tokens)
            .leftJoin(Applications, eq(Tokens.applicationId, Applications.id))
            .where(eq(Tokens.accessToken, access_token))
            .limit(1)
    )[0];

    if (!output?.token.userId) return { user: null, application: null };

    const user = await User.fromId(output.token.userId);

    return { user, application: output.application ?? null };
};

export const retrieveToken = async (
    access_token: string,
): Promise<Token | null> => {
    if (!access_token) return null;

    return (
        (await db.query.Tokens.findFirst({
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
    user: User,
    other: User,
): Promise<InferSelectModel<typeof Relationships>> => {
    const foundRelationship = await db.query.Relationships.findFirst({
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

export const followRequestToLysand = (
    follower: User,
    followee: User,
): Lysand.Follow => {
    if (follower.isRemote()) {
        throw new Error("Follower must be a local user");
    }

    if (!followee.isRemote()) {
        throw new Error("Followee must be a remote user");
    }

    if (!followee.getUser().uri) {
        throw new Error("Followee must have a URI in database");
    }

    const id = crypto.randomUUID();

    return {
        type: "Follow",
        id: id,
        author: follower.getUri(),
        followee: followee.getUri(),
        created_at: new Date().toISOString(),
        uri: new URL(`/follows/${id}`, config.http.base_url).toString(),
    };
};

export const followAcceptToLysand = (
    follower: User,
    followee: User,
): Lysand.FollowAccept => {
    if (!follower.isRemote()) {
        throw new Error("Follower must be a remote user");
    }

    if (followee.isRemote()) {
        throw new Error("Followee must be a local user");
    }

    if (!follower.getUser().uri) {
        throw new Error("Follower must have a URI in database");
    }

    const id = crypto.randomUUID();

    return {
        type: "FollowAccept",
        id: id,
        author: followee.getUri(),
        created_at: new Date().toISOString(),
        follower: follower.getUri(),
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
