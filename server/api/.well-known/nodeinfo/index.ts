import { MatchedRoute } from "bun";
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
	route: "/.well-known/nodeinfo",
});


/**
 * Redirect to /nodeinfo/2.0
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const config = getConfig();

	return new Response("", {
		status: 301,
		headers: {
			Location: `${config.http.base_url}/.well-known/nodeinfo/2.0`,
		},
	});
};
