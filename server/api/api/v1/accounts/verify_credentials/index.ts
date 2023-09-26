import { errorResponse, jsonResponse } from "@response";
import { User } from "~database/entities/User";

/**
 * Patches a user
 */
export default async (req: Request): Promise<Response> => {
	// TODO: Add checks for disabled or not email verified accounts
	// Check if request is a PATCH request
	if (req.method !== "GET")
		return errorResponse("This method requires a GET request", 405);

	// Check auth token
	const token = req.headers.get("Authorization")?.split(" ")[1] || null;

	if (!token)
		return errorResponse("This method requires an authenticated user", 422);

	const user = await User.retrieveFromToken(token);

	if (!user) return errorResponse("Unauthorized", 401);

	return jsonResponse({
		...(await user.toAPI()),
		source: user.source,
		// TODO: Add role support
		role: {
			id: 0,
			name: "",
			permissions: "",
			color: "",
			highlighted: false,
		},
	});
};
