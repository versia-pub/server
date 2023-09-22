import { getUserByToken } from "@auth";
import { errorResponse, jsonResponse } from "@response";

/**
 * Patches a user
 */
export default async (req: Request): Promise<Response> => {
	// Check if request is a PATCH request
	if (req.method !== "GET")
		return errorResponse("This method requires a GET request", 405);

	// Check auth token
	const token = req.headers.get("Authorization")?.split(" ")[1] || null;

	if (!token)
		return errorResponse("This method requires an authenticated user", 422);

	const user = await getUserByToken(token);

	if (!user) return errorResponse("Unauthorized", 401);

	// TODO: Add Source fields
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
