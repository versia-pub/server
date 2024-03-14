import { errorResponse, jsonResponse } from "@response";
import { userToAPI } from "~database/entities/User";
import { apiRoute, applyConfig } from "@api";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/api/v1/accounts/verify_credentials",
	ratelimits: {
		max: 100,
		duration: 60,
	},
	auth: {
		required: true,
		oauthPermissions: ["read:accounts"],
	},
});

export default apiRoute((req, matchedRoute, extraData) => {
	// TODO: Add checks for disabled or not email verified accounts

	const { user } = extraData.auth;

	if (!user) return errorResponse("Unauthorized", 401);

	return jsonResponse({
		...userToAPI(user, true),
	});
});
