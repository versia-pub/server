/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Like as LysandLike } from "~types/lysand/Object";
import { getConfig } from "@config";
import { Like } from "@prisma/client";

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
