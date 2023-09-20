import { getUserByToken } from "@auth";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { RawActor } from "~database/entities/RawActor";

/**
 * Fetch a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	// Check auth token
	const token = req.headers.get("Authorization")?.split(" ")[1] || null;
	const user = await getUserByToken(token);

	const foundUser = await RawActor.findOneBy({
		id,
	});

	if (!foundUser) return errorResponse("User not found", 404);

	return jsonResponse(
		await foundUser.toAPIAccount(user?.id === foundUser.id)
	);
};
