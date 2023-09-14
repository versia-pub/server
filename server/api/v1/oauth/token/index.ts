import { errorResponse, jsonResponse } from "@response";
import { Token } from "~database/entities/Token";

/**
 * Allows getting token from OAuth code
 */
export default async (req: Request): Promise<Response> => {
	const body = await req.formData();

	const grant_type = body.get("grant_type")?.toString() || null;
	const code = body.get("code")?.toString() || "";
	const redirect_uri = body.get("redirect_uri")?.toString() || "";
	const client_id = body.get("client_id")?.toString() || "";
	const client_secret = body.get("client_secret")?.toString() || "";
	const scope = body.get("scope")?.toString() || null;

	if (grant_type !== "authorization_code")
		return errorResponse(
			"Invalid grant type (try 'authorization_code')",
			400
		);

	// Get associated token
	const token = await Token.findOneBy({
		code,
		application: {
			client_id,
			secret: client_secret,
			redirect_uris: redirect_uri,
		},
		scope: scope?.replaceAll("+", " "),
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
