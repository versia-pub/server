import { errorResponse, jsonResponse } from "@response";
import { userToAPI } from "~database/entities/User";
import { applyConfig } from "@api";
import type { RouteHandler } from "~server/api/routes.type";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/api/v1/accounts/verify_credentials",
	ratelimits: {
		max: 100,
		duration: 60,
	},
	auth: {
		required: true,
	},
});

const handler: RouteHandler<> = (req, matchedRoute, extraData) => {};

const handler: RouteHandler<""> = (req, matchedRoute, extraData) => {
	// TODO: Add checks for disabled or not email verified accounts

	const { user } = extraData.auth;

	if (!user) return errorResponse("Unauthorized", 401);

	return jsonResponse({
		...userToAPI(user, true),
	});
};

export default handler;
