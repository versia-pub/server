/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { applyConfig } from "@api";
import { jsonResponse } from "@response";
import { MatchedRoute } from "bun";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	auth: {
		required: false,
	},
	ratelimits: {
		duration: 60,
		max: 500,
	},
	route: "/object/:id",
});

/**
 * Fetch a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	return jsonResponse({});
};
