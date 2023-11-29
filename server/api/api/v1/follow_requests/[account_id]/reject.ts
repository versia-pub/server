import { errorResponse, jsonResponse } from "@response";
import { getFromRequest, userRelations } from "~database/entities/User";
import { applyConfig } from "@api";
import { client } from "~database/datasource";
import type { MatchedRoute } from "bun";
import {
	checkForBidirectionalRelationships,
	relationshipToAPI,
} from "~database/entities/Relationship";

export const meta = applyConfig({
	allowedMethods: ["POST"],
	route: "/api/v1/follow_requests/:account_id/reject",
	ratelimits: {
		max: 100,
		duration: 60,
	},
	auth: {
		required: true,
	},
});

export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const { user } = await getFromRequest(req);

	if (!user) return errorResponse("Unauthorized", 401);

	const { account_id } = matchedRoute.params;

	const account = await client.user.findUnique({
		where: {
			id: account_id,
		},
		include: userRelations,
	});

	if (!account) return errorResponse("Account not found", 404);

	// Check if there is a relationship on both sides
	await checkForBidirectionalRelationships(user, account);

	// Reject follow request
	await client.relationship.updateMany({
		where: {
			subjectId: user.id,
			ownerId: account.id,
			requested: true,
		},
		data: {
			requested: false,
		},
	});

	const relationship = await client.relationship.findFirst({
		where: {
			subjectId: account.id,
			ownerId: user.id,
		},
	});

	if (!relationship) return errorResponse("Relationship not found", 404);

	return jsonResponse(relationshipToAPI(relationship));
};
