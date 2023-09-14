import { errorResponse, jsonResponse } from "@response";
import { randomBytes } from "crypto";
import { Application } from "~database/entities/Application";

/**
 * Creates a new application to obtain OAuth 2 credentials
 */
export default async (req: Request): Promise<Response> => {
	const body = await req.formData();

	const client_name = body.get("client_name")?.toString() || null;
	const redirect_uris = body.get("redirect_uris")?.toString() || null;
	const scopes = body.get("scopes")?.toString() || null;
	const website = body.get("website")?.toString() || null;

	const application = new Application();

	application.name = client_name || "";

	// Check if redirect URI is a valid URI, and also an absolute URI
	if (redirect_uris) {
		try {
			const redirect_uri = new URL(redirect_uris);

			if (!redirect_uri.protocol.startsWith("http")) {
				return errorResponse(
					"Redirect URI must be an absolute URI",
					422
				);
			}

			application.redirect_uris = redirect_uris;
		} catch {
			return errorResponse("Redirect URI must be a valid URI", 422);
		}
	}

	application.scopes = scopes || "read";
	application.website = website || null;

	application.client_id = randomBytes(32).toString("base64url");
	application.secret = randomBytes(64).toString("base64url");

	await application.save();

	return jsonResponse({
		id: application.id,
		name: application.name,
		website: application.website,
		client_id: application.client_id,
		client_secret: application.secret,
		redirect_uri: application.redirect_uris,
		vapid_link: application.vapid_key,
	});
};
