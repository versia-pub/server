import type { InferSelectModel } from "drizzle-orm";
import { db } from "~drizzle/db";
import { relationship } from "~drizzle/schema";
import type { Relationship as APIRelationship } from "~types/mastodon/relationship";
import type { User } from "./User";

export type Relationship = InferSelectModel<typeof relationship>;

/**
 * Creates a new relationship between two users.
 * @param owner The user who owns the relationship.
 * @param other The user who is the subject of the relationship.
 * @returns The newly created relationship.
 */
export const createNewRelationship = async (
    owner: User,
    other: User,
): Promise<Relationship> => {
    return (
        await db
            .insert(relationship)
            .values({
                ownerId: owner.id,
                subjectId: other.id,
                languages: [],
                following: false,
                showingReblogs: false,
                notifying: false,
                followedBy: false,
                blocking: false,
                blockedBy: false,
                muting: false,
                mutingNotifications: false,
                requested: false,
                domainBlocking: false,
                endorsed: false,
                note: "",
                updatedAt: new Date().toISOString(),
            })
            .returning()
    )[0];
};

export const checkForBidirectionalRelationships = async (
    user1: User,
    user2: User,
    createIfNotExists = true,
): Promise<boolean> => {
    const relationship1 = await db.query.relationship.findFirst({
        where: (rel, { and, eq }) =>
            and(eq(rel.ownerId, user1.id), eq(rel.subjectId, user2.id)),
    });

    const relationship2 = await db.query.relationship.findFirst({
        where: (rel, { and, eq }) =>
            and(eq(rel.ownerId, user2.id), eq(rel.subjectId, user1.id)),
    });

    if (!relationship1 && !relationship2 && createIfNotExists) {
        await createNewRelationship(user1, user2);
        await createNewRelationship(user2, user1);
    }

    return !!relationship1 && !!relationship2;
};

/**
 * Converts the relationship to an API-friendly format.
 * @returns The API-friendly relationship.
 */
export const relationshipToAPI = (rel: Relationship): APIRelationship => {
    return {
        blocked_by: rel.blockedBy,
        blocking: rel.blocking,
        domain_blocking: rel.domainBlocking,
        endorsed: rel.endorsed,
        followed_by: rel.followedBy,
        following: rel.following,
        id: rel.subjectId,
        muting: rel.muting,
        muting_notifications: rel.mutingNotifications,
        notifying: rel.notifying,
        requested: rel.requested,
        showing_reblogs: rel.showingReblogs,
        note: rel.note,
    };
};
