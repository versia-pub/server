import { applyConfig } from "@api";
import type { MatchedRoute } from "bun";
import { randomBytes } from "crypto";
import { client } from "~database/datasource";
import { TokenType } from "~database/entities/Token";
import { userRelations } from "~database/entities/User";
import type { APIRouteMeta } from "~types/api";

export const meta: APIRouteMeta = applyConfig({
	allowedMethods: ["POST"],
	ratelimits: {
		max: 4,
		duration: 60,
	},
	route: "/auth/login",
	auth: {
		required: false,
	},
});

/**
 * OAuth Code flow
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const scopes = (matchedRoute.query.scope || "")
		.replaceAll("+", " ")
		.split(" ");
	const redirect_uri = matchedRoute.query.redirect_uri;
	const response_type = matchedRoute.query.response_type;
	const client_id = matchedRoute.query.client_id;

	const formData = await req.formData();

	const email = formData.get("email")?.toString() || null;
	const password = formData.get("password")?.toString() || null;

	const redirectToLogin = (error: string) =>
		Response.redirect(
			`/oauth/authorize?` +
				new URLSearchParams({
					...matchedRoute.query,
					error: encodeURIComponent(error),
				}).toString(),
			302
		);

	if (response_type !== "code")
		return redirectToLogin("Invalid response_type");

	if (!email || !password)
		return redirectToLogin("Invalid username or password");

	// Get user
	const user = await client.user.findFirst({
		where: {
			email,
		},
		include: userRelations,
	});

	if (!user || !(await Bun.password.verify(password, user.password || "")))
		return redirectToLogin("Invalid username or password");

	// Get application
	const application = await client.application.findFirst({
		where: {
			client_id,
		},
	});

	if (!application) return redirectToLogin("Invalid client_id");

	const code = randomBytes(32).toString("hex");

	await client.application.update({
		where: { id: application.id },
		data: {
			tokens: {
				create: {
					access_token: randomBytes(64).toString("base64url"),
					code: code,
					scope: scopes.join(" "),
					token_type: TokenType.BEARER,
					user: {
						connect: {
							id: user.id,
						},
					},
				},
			},
		},
	});

	// Redirect back to application
	return Response.redirect(`${redirect_uri}?code=${code}`, 302);
};
