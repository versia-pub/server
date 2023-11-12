import { errorResponse, jsonResponse } from "@response";
import { getFromRequest, userToAPI } from "~database/entities/User";
import { applyConfig } from "@api";

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

export default async (req: Request): Promise<Response> => {
	// TODO: Add checks for disabled or not email verified accounts

	const { user } = await getFromRequest(req);

	if (!user) return errorResponse("Unauthorized", 401);

	return jsonResponse({
		...(await userToAPI(user, true)),
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
