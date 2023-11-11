import { Relationship, User } from "@prisma/client";
import { APIRelationship } from "~types/entities/relationship";
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
export const createNew = async (
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

/**
 * Converts the relationship to an API-friendly format.
 * @returns The API-friendly relationship.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export const toAPI = async (rel: Relationship): Promise<APIRelationship> => {
	return {
		blocked_by: rel.blockedBy,
		blocking: rel.blocking,
		domain_blocking: rel.domainBlocking,
		endorsed: rel.endorsed,
		followed_by: rel.followedBy,
		following: rel.following,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		id: (rel as any).subject.id,
		muting: rel.muting,
		muting_notifications: rel.mutingNotifications,
		notifying: rel.notifying,
		requested: rel.requested,
		showing_reblogs: rel.showingReblogs,
		languages: rel.languages,
		note: rel.note,
	};
};
