import { errorResponse } from "@response";
import { MatchedRoute } from "bun";
import { randomBytes } from "crypto";
import { Application } from "~database/entities/Application";
import { Token } from "~database/entities/Token";
import { User } from "~database/entities/User";

/**
 * OAuth Code flow
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const scopes = matchedRoute.query.scopes.replaceAll("+", " ").split(" ");
	const redirect_uri = matchedRoute.query.redirect_uri;
	const response_type = matchedRoute.query.response_type;
	const client_id = matchedRoute.query.client_id;

	const formData = await req.formData();

	const username = formData.get("username")?.toString() || null;
	const password = formData.get("password")?.toString() || null;

	if (response_type !== "code")
		return errorResponse("Invalid response type (try 'code')", 400);

	if (!username || !password)
		return errorResponse("Missing username or password", 400);

	// Get user
	const user = await User.findOneBy({
		username,
	});

	if (!user || !(await Bun.password.verify(password, user.password)))
		return errorResponse("Invalid username or password", 401);

	// Get application
	const application = await Application.findOneBy({
		client_id,
	});

	if (!application) return errorResponse("Invalid client_id", 404);

	const token = new Token();

	token.access_token = randomBytes(64).toString("base64url");
	token.code = randomBytes(32).toString("hex");
	token.application = application;
	token.scope = scopes.join(" ");
	token.user = user;

	await token.save();

	// Redirect back to application
	return new Response(null, {
		status: 302,
		headers: {
			Location: `${redirect_uri}?code=${token.code}`,
		},
	});
};
