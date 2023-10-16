import { applyConfig } from "@api";
import { MatchedRoute } from "bun";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	auth: {
		required: false,
	},
	ratelimits: {
		duration: 60,
		max: 20,
	},
	route: "/oauth/authorize",
});

/**
 * Returns an HTML login form
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const html = Bun.file("./pages/login.html");
	const css = Bun.file("./pages/uno.css");
	return new Response(
		(await html.text())
			.replace(
				"{{URL}}",
				`/auth/login?redirect_uri=${matchedRoute.query.redirect_uri}&response_type=${matchedRoute.query.response_type}&client_id=${matchedRoute.query.client_id}&scope=${matchedRoute.query.scope}`
			)
			.replace("{{STYLES}}", `<style>${await css.text()}</style>`),
		{
			headers: {
				"Content-Type": "text/html",
			},
		}
	);
};
