import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import {
	getFromRequest,
	userRelations,
	userToAPI,
} from "~database/entities/User";
import { applyConfig } from "@api";
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
export default async (req: Request): Promise<Response> => {
	const { user: self } = await getFromRequest(req);

	if (!self) return errorResponse("Unauthorized", 401);

	const { "id[]": ids } = await parseRequest<{
		"id[]": string[];
	}>(req);

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
						in: followersOfIds.map(u => u.id),
					},
					following: true,
				},
			},
		},
		include: userRelations,
	});

	return jsonResponse(output.map(o => userToAPI(o)));
};
