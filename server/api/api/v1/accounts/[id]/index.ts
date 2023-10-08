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

	// Check auth token
	const token = req.headers.get("Authorization")?.split(" ")[1];

	if (!token)
		return errorResponse("This method requires an authenticated user", 422);

	const user = await User.retrieveFromToken(token);

	let foundUser: User | null;
	try {
		foundUser = await User.findOneBy({
			id,
		});
	} catch (e) {
		return errorResponse("Invalid ID", 404);
	}

	if (!foundUser) return errorResponse("User not found", 404);

	return jsonResponse(await foundUser.toAPI(user?.id === foundUser.id));
};
