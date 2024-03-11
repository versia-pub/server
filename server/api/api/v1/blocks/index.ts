import { errorResponse, jsonResponse } from "@response";
import { userRelations, userToAPI } from "~database/entities/User";
import { apiRoute, applyConfig } from "@api";
import { client } from "~database/datasource";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/api/v1/blocks",
	ratelimits: {
		max: 100,
		duration: 60,
	},
	auth: {
		required: true,
	},
});

export default apiRoute(async (req, matchedRoute, extraData) => {
	const { user } = extraData.auth;

	if (!user) return errorResponse("Unauthorized", 401);

	const blocks = await client.user.findMany({
		where: {
			relationshipSubjects: {
				some: {
					ownerId: user.id,
					blocking: true,
				},
			},
		},
		include: userRelations,
	});

	return jsonResponse(blocks.map(u => userToAPI(u)));
});
