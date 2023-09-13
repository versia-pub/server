import { MatchedRoute } from "bun";
import { getHost } from "@config";

/**
 * Redirect to /nodeinfo/2.0
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	return new Response("", {
		status: 301,
		headers: {
			Location: `https://${getHost()}/.well-known/nodeinfo/2.0`,
		},
	});
};
