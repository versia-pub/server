/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { createLike } from "~database/entities/Like";
import {
	isViewableByUser,
	statusAndUserRelations,
	statusToAPI,
} from "~database/entities/Status";
import type { APIRouteMeta } from "~types/api";
import type { APIStatus } from "~types/entities/status";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["POST"],
	ratelimits: {
		max: 100,
		duration: 60,
	},
	route: "/api/v1/statuses/:id/favourite",
	auth: {
		required: true,
	},
});

/**
 * Favourite a post
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
	const id = matchedRoute.params.id;

	const { user } = extraData.auth;

	if (!user) return errorResponse("Unauthorized", 401);

	const status = await client.status.findUnique({
		where: { id },
		include: statusAndUserRelations,
	});

	// Check if user is authorized to view this status (if it's private)
	if (!status || !isViewableByUser(status, user))
		return errorResponse("Record not found", 404);

	const existingLike = await client.like.findFirst({
		where: {
			likedId: status.id,
			likerId: user.id,
		},
	});

	if (!existingLike) {
		await createLike(user, status);
	}

	return jsonResponse({
		...(await statusToAPI(status, user)),
		favourited: true,
		favourites_count: status._count.likes + 1,
	} as APIStatus);
});
