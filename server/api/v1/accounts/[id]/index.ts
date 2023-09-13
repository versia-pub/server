import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { User } from "~database/entities/User";

/**
 * Fetch a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const user = await User.findOneBy({
		id,
	});

	if (!user) return errorResponse("User not found", 404);

	return jsonResponse(user.toAPI());
};
