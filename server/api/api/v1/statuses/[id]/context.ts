import { applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { Status, statusAndUserRelations } from "~database/entities/Status";
import { UserAction } from "~database/entities/User";
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

	const { user } = await UserAction.getFromRequest(req);

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

	// Get all ancestors
	const ancestors = await foundStatus.getAncestors(user);
	const descendants = await foundStatus.getDescendants(user);

	return jsonResponse({
		ancestors: await Promise.all(ancestors.map(status => status.toAPI())),
		descendants: await Promise.all(
			descendants.map(status => status.toAPI())
		),
	});
};
