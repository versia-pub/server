import { applyConfig } from "@api";
import { errorResponse, jsonLdResponse } from "@response";
import { MatchedRoute } from "bun";
import { RawActivity } from "~database/entities/RawActivity";

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
	const object = await RawActivity.findOneBy({
		id: matchedRoute.params.id,
	});

	if (!object) return errorResponse("Object not found", 404);

	return jsonLdResponse(object);
};
