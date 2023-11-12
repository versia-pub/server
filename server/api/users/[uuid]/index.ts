/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { applyConfig } from "@api";
import { getConfig } from "@config";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { client } from "~database/datasource";
import { userRelations, userToLysand } from "~database/entities/User";

export const meta = applyConfig({
	allowedMethods: ["POST"],
	auth: {
		required: false,
	},
	ratelimits: {
		duration: 60,
		max: 500,
	},
	route: "/users/:uuid",
});

/**
 * ActivityPub user inbox endpoint
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const uuid = matchedRoute.params.uuid;

	const config = getConfig();

	const user = await client.user.findUnique({
		where: {
			id: uuid,
		},
		include: userRelations,
	});

	if (!user) {
		return errorResponse("User not found", 404);
	}

	return jsonResponse(userToLysand(user));
};
