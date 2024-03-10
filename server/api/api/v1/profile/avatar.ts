import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { userRelations, userToAPI } from "~database/entities/User";
import type { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["DELETE"],
	ratelimits: {
		max: 10,
		duration: 60,
	},
	route: "/api/v1/profile/avatar",
	auth: {
		required: true,
	},
});

/**
 * Deletes a user avatar
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
	const { user } = extraData.auth;

	if (!user) return errorResponse("Unauthorized", 401);

	// Delete user avatar
	const newUser = await client.user.update({
		where: {
			id: user.id,
		},
		data: {
			avatar: "",
		},
		include: userRelations,
	});

	return jsonResponse(userToAPI(newUser));
});
