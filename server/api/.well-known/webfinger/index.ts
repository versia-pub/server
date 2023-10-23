import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { User, userRelations } from "~database/entities/User";
import { getConfig, getHost } from "@config";
import { applyConfig } from "@api";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	auth: {
		required: false,
	},
	ratelimits: {
		duration: 60,
		max: 60,
	},
	route: "/.well-known/webfinger",
});

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

	const config = getConfig();

	// Check if user is a local user
	if (requestedUser.split("@")[1] !== getHost()) {
		return errorResponse("User is a remote user", 404);
	}

	const user = await User.findOne({
		where: { username: requestedUser.split("@")[0] },
		relations: userRelations
	});

	if (!user) {
		return errorResponse("User not found", 404);
	}

	return jsonResponse({
		subject: `acct:${user.username}@${getHost()}`,

		links: [
			{
				rel: "self",
				type: "application/activity+json",
				href: `${config.http.base_url}/users/${user.username}/actor`
			},
			{
				rel: "https://webfinger.net/rel/profile-page",
				type: "text/html",
				href: `${config.http.base_url}/users/${user.username}`
			},
			{
				rel: "self",
				type: "application/activity+json; profile=\"https://www.w3.org/ns/activitystreams\"",
				href: `${config.http.base_url}/users/${user.username}/actor`
			}
		]
	})
};
