import { errorResponse, jsonResponse } from "@response";
import type { MatchedRoute } from "bun";
import type { UserWithRelations } from "~database/entities/User";
import {
	getFromRequest,
	userRelations,
	userToAPI,
} from "~database/entities/User";
import { applyConfig } from "@api";
import { client } from "~database/datasource";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	ratelimits: {
		max: 30,
		duration: 60,
	},
	route: "/accounts/:id",
	auth: {
		required: true,
	},
});

/**
 * Fetch a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;
	// Check if ID is valid UUID
	if (!id.match(/^[0-9a-fA-F]{24}$/)) {
		return errorResponse("Invalid ID", 404);
	}

	const { user } = await getFromRequest(req);

	let foundUser: UserWithRelations | null;
	try {
		foundUser = await client.user.findUnique({
			where: { id },
			include: userRelations,
		});
	} catch (e) {
		return errorResponse("Invalid ID", 404);
	}

	if (!foundUser) return errorResponse("User not found", 404);

	return jsonResponse(userToAPI(foundUser, user?.id === foundUser.id));
};
