/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { Like } from "~database/entities/Like";
import { Status, statusAndUserRelations } from "~database/entities/Status";
import { UserAction } from "~database/entities/User";
import { APIRouteMeta } from "~types/api";

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

	const { user } = await UserAction.getFromRequest(req);

	if (!user) return errorResponse("Unauthorized", 401);

	let foundStatus: Status | null;
	try {
		foundStatus = await Status.findOne({
			where: {
				id,
			},
			relations: statusAndUserRelations,
		});
	} catch (e) {
		return errorResponse("Invalid ID", 404);
	}

	if (!foundStatus) return errorResponse("Record not found", 404);

	// Check if user is authorized to view this status (if it's private)
	if (!foundStatus.isViewableByUser(user)) {
		return errorResponse("Record not found", 404);
	}

	await Like.delete({
		liked: {
			id: foundStatus.id,
		},
		liker: {
			id: user.id,
		},
	});

	return jsonResponse(await foundStatus.toAPI());
};
