import { applyConfig } from "@api";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";

export const meta = applyConfig({
	allowedMethods: ["POST"],
	auth: {
		required: false,
	},
	ratelimits: {
		duration: 60,
		max: 10,
	},
	route: "/oauth/token",
});

/**
 * Allows getting token from OAuth code
 */
export default async (req: Request): Promise<Response> => {
	const { grant_type, code, redirect_uri, client_id, client_secret, scope } =
		await parseRequest<{
			grant_type: string;
			code: string;
			redirect_uri: string;
			client_id: string;
			client_secret: string;
			scope: string;
		}>(req);

	if (grant_type !== "authorization_code")
		return errorResponse(
			"Invalid grant type (try 'authorization_code')",
			400
		);

	// Get associated token
	const token = await client.token.findFirst({
		where: {
			code,
			application: {
				client_id,
				secret: client_secret,
				redirect_uris: redirect_uri,
				scopes: scope?.replaceAll("+", " "),
			},
			scope: scope?.replaceAll("+", " "),
		},
		include: {
			application: true,
		},
	});

	if (!token)
		return errorResponse("Invalid access token or client credentials", 401);

	return jsonResponse({
		access_token: token.access_token,
		token_type: token.token_type,
		scope: token.scope,
		created_at: token.created_at,
	});
};
