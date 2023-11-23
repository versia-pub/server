/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { Like as LysandLike } from "~types/lysand/Object";
import { getConfig } from "@config";
import type { Like } from "@prisma/client";
import { client } from "~database/datasource";
import type { UserWithRelations } from "./User";
import type { StatusWithRelations } from "./Status";

/**
 * Represents a Like entity in the database.
 */

export const toLysand = (like: Like): LysandLike => {
	return {
		id: like.id,
		author: (like as any).liker?.uri,
		type: "Like",
		created_at: new Date(like.createdAt).toISOString(),
		object: (like as any).liked?.uri,
		uri: `${getConfig().http.base_url}/actions/${like.id}`,
	};
};

export const createLike = async (
	user: UserWithRelations,
	status: StatusWithRelations
) => {
	await client.like.create({
		data: {
			likedId: status.id,
			likerId: user.id,
		},
	});

	if (status.author.instanceId === user.instanceId) {
		// Notify the user that their post has been favourited
		await client.notification.create({
			data: {
				accountId: user.id,
				type: "favourite",
				notifiedId: status.authorId,
				statusId: status.id,
			},
		});
	} else {
		// TODO: Add database jobs for federating this
	}
};
