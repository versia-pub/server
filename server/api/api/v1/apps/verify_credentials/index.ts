import { getUserByToken } from "@auth";
import { errorResponse, jsonResponse } from "@response";
import { Application } from "~database/entities/Application";

/**
 * Returns OAuth2 credentials
 */
export default async (req: Request): Promise<Response> => {
	// Check auth token
	const token = req.headers.get("Authorization")?.split(" ")[1] || null;

	if (!token)
		return errorResponse("This method requires an authenticated user", 422);

	const user = await getUserByToken(token);
	const application = await Application.getFromToken(token);

	if (!user) return errorResponse("Unauthorized", 401);
	if (!application) return errorResponse("Unauthorized", 401);

	return jsonResponse({
		name: application.name,
		website: application.website,
		vapid_key: application.vapid_key,
		redirect_uris: application.redirect_uris,
		scopes: application.scopes,
	});
};
