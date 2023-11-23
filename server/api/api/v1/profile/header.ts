import { applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import {
	getFromRequest,
	userRelations,
	userToAPI,
} from "~database/entities/User";
import type { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["DELETE"],
	ratelimits: {
		max: 10,
		duration: 60,
	},
	route: "/api/v1/profile/header",
	auth: {
		required: true,
	},
});

/**
 * Deletes a user header
 */
export default async (req: Request): Promise<Response> => {
	const { user } = await getFromRequest(req);

	if (!user) return errorResponse("Unauthorized", 401);

	// Delete user header
	const newUser = await client.user.update({
		where: {
			id: user.id,
		},
		data: {
			header: "",
		},
		include: userRelations,
	});

	return jsonResponse(userToAPI(newUser));
};
