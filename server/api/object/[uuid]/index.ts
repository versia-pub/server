import { errorResponse, jsonLdResponse } from "@response";
import { MatchedRoute } from "bun";
import { RawObject } from "~database/entities/RawObject";

/**
 * Fetch a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const object = await RawObject.findOneBy({
		id: matchedRoute.params.id
	});

	if (!object) return errorResponse("Object not found", 404)

	return jsonLdResponse(object);
};
