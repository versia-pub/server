import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { User } from "~database/entities/User";
import { getHost } from "@config";

/**
 * ActivityPub WebFinger endpoint
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	// In the format acct:name@example.com
	const resource = matchedRoute.query.resource;
	const requestedUser = resource.split("acct:")[1];

	// Check if user is a local user
	if (requestedUser.split("@")[1] !== getHost()) {
		return errorResponse("User is a remote user", 404);
	}

	const user = await User.findOneBy({ username: requestedUser.split("@")[0] });

	if (!user) {
		return errorResponse("User not found", 404);
	}

	return jsonResponse({
		subject: `acct:${user.username}@${getHost()}`,

		links: [
			{
				rel: "self",
				type: "application/activity+json",
				href: `${getHost()}/@${user.username}/actor`
			},
		]
	})
};
