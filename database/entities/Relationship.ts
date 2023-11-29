import type { Relationship, User } from "@prisma/client";
import type { APIRelationship } from "~types/entities/relationship";
import { client } from "~database/datasource";

/**
 * Stores Mastodon API relationships
 */

/**
 * Creates a new relationship between two users.
 * @param owner The user who owns the relationship.
 * @param other The user who is the subject of the relationship.
 * @returns The newly created relationship.
 */
export const createNewRelationship = async (
	owner: User,
	other: User
): Promise<Relationship> => {
	return await client.relationship.create({
		data: {
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
		},
	});
};

export const checkForBidirectionalRelationships = async (
	user1: User,
	user2: User,
	createIfNotExists = true
): Promise<boolean> => {
	const relationship1 = await client.relationship.findFirst({
		where: {
			ownerId: user1.id,
			subjectId: user2.id,
		},
	});

	const relationship2 = await client.relationship.findFirst({
		where: {
			ownerId: user2.id,
			subjectId: user1.id,
		},
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
		languages: rel.languages,
		note: rel.note,
	};
};
