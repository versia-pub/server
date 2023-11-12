/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { client } from "~database/datasource";
import {
	isViewableByUser,
	statusAndUserRelations,
	statusToAPI,
} from "~database/entities/Status";
import { getFromRequest } from "~database/entities/User";
import { APIRouteMeta } from "~types/api";
import { APIStatus } from "~types/entities/status";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["POST"],
	ratelimits: {
		max: 100,
		duration: 60,
	},
	route: "/api/v1/statuses/:id/unfavourite",
	auth: {
		required: true,
	},
});

/**
 * Unfavourite a post
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const { user } = await getFromRequest(req);

	if (!user) return errorResponse("Unauthorized", 401);

	const status = await client.status.findUnique({
		where: { id },
		include: statusAndUserRelations,
	});

	// Check if user is authorized to view this status (if it's private)
	if (!status || !isViewableByUser(status, user))
		return errorResponse("Record not found", 404);

	await client.like.deleteMany({
		where: {
			likedId: status.id,
			likerId: user.id,
		},
	});

	return jsonResponse({
		...(await statusToAPI(status, user)),
		favourited: false,
		favourites_count: status._count.likes - 1,
	} as APIStatus);
};
