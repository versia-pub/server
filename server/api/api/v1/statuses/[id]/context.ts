import { applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { RawObject } from "~database/entities/RawObject";
import { Status } from "~database/entities/Status";
import { User } from "~database/entities/User";
import { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["GET"],
	ratelimits: {
		max: 100,
		duration: 60,
	},
	route: "/api/v1/statuses/:id/context",
	auth: {
		required: false,
	},
});

/**
 * Fetch a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	// Public for public statuses limited to 40 ancestors and 60 descendants with a maximum depth of 20.
	// User token + read:statuses for up to 4,096 ancestors, 4,096 descendants, unlimited depth, and private statuses.
	const id = matchedRoute.params.id;

	const { user } = await User.getFromRequest(req);

	let foundStatus: RawObject | null;
	try {
		foundStatus = await RawObject.findOneBy({
			id,
		});
	} catch (e) {
		return errorResponse("Invalid ID", 404);
	}

	if (!foundStatus) return errorResponse("Record not found", 404);

	// Get all ancestors
	const ancestors = await foundStatus.getAncestors();

	return jsonResponse({});
};
