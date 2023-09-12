import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { User } from "~database/entities/User";
import { getHost } from "@config";
import { compact } from "jsonld";

/**
 * ActivityPub user actor endpoinmt
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	// In the format acct:name@example.com
	const username = matchedRoute.params.username;

	const user = await User.findOneBy({ username });

	if (!user) {
		return errorResponse("User not found", 404);
	}

	return jsonResponse(
		await compact({
			"@context": [
				"https://www.w3.org/ns/activitystreams",
				"https://w3id.org/security/v1",
			],
			id: `${getHost()}/@${user.username}/actor`,
			type: "Person",
			preferredUsername: user.username,
			summary: user.bio,
			inbox: `${getHost()}/@${user.username}/inbox`,
		})
	);
};
