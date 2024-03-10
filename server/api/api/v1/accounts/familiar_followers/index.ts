import { errorResponse, jsonResponse } from "@response";
import { userRelations, userToAPI } from "~database/entities/User";
import { apiRoute, applyConfig } from "@api";
import { client } from "~database/datasource";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/api/v1/accounts/familiar_followers",
	ratelimits: {
		max: 5,
		duration: 60,
	},
	auth: {
		required: true,
	},
});

/**
 * Find familiar followers (followers of a user that you also follow)
 */
export default apiRoute<{
	"id[]": string[];
}>(async (req, matchedRoute, extraData) => {
	const { user: self } = extraData.auth;

	if (!self) return errorResponse("Unauthorized", 401);

	const { "id[]": ids } = extraData.parsedRequest;

	// Minimum id count 1, maximum 10
	if (!ids || ids.length < 1 || ids.length > 10) {
		return errorResponse("Number of ids must be between 1 and 10", 422);
	}

	const followersOfIds = await client.user.findMany({
		where: {
			relationships: {
				some: {
					subjectId: {
						in: ids,
					},
					following: true,
				},
			},
		},
	});

	// Find users that you follow in followersOfIds
	const output = await client.user.findMany({
		where: {
			relationships: {
				some: {
					ownerId: self.id,
					subjectId: {
						in: followersOfIds.map(f => f.id),
					},
					following: true,
				},
			},
		},
		include: userRelations,
	});

	return jsonResponse(output.map(o => userToAPI(o)));
});
