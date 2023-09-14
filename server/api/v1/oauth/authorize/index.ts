import { MatchedRoute } from "bun";

/**
 * Returns an HTML login form
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const html = Bun.file("./pages/login.html");
	return new Response(
		(await html.text()).replace(
			"{{URL}}",
			`/auth/login?redirect_uri=${matchedRoute.query.redirect_uri}&response_type=${matchedRoute.query.response_type}&client_id=${matchedRoute.query.client_id}&scopes=${matchedRoute.query.scopes}`
		),
		{
			headers: {
				"Content-Type": "text/html",
			},
		}
	);
};
