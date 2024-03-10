import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import {
	getAncestors,
	getDescendants,
	statusAndUserRelations,
	statusToAPI,
} from "~database/entities/Status";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	ratelimits: {
		max: 8,
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
export default apiRoute(async (req, matchedRoute, extraData) => {
	// Public for public statuses limited to 40 ancestors and 60 descendants with a maximum depth of 20.
	// User token + read:statuses for up to 4,096 ancestors, 4,096 descendants, unlimited depth, and private statuses.
	const id = matchedRoute.params.id;

	const { user } = extraData.auth;

	const foundStatus = await client.status.findUnique({
		where: { id },
		include: statusAndUserRelations,
	});

	if (!foundStatus) return errorResponse("Record not found", 404);

	// Get all ancestors
	const ancestors = await getAncestors(foundStatus, user);
	const descendants = await getDescendants(foundStatus, user);

	return jsonResponse({
		ancestors: await Promise.all(
			ancestors.map(status => statusToAPI(status, user || undefined))
		),
		descendants: await Promise.all(
			descendants.map(status => statusToAPI(status, user || undefined))
		),
	});
});
