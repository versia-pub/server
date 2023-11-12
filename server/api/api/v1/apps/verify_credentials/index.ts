import { applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { getFromToken } from "~database/entities/Application";
import { getFromRequest } from "~database/entities/User";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/api/v1/apps/verify_credentials",
	ratelimits: {
		max: 100,
		duration: 60,
	},
	auth: {
		required: true,
	},
});

/**
 * Returns OAuth2 credentials
 */
export default async (req: Request): Promise<Response> => {
	const { user, token } = await getFromRequest(req);
	const application = await getFromToken(token);

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
