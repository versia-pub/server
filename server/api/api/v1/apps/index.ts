import { applyConfig } from "@api";
import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { randomBytes } from "crypto";
import { Application } from "~database/entities/Application";

export const meta = applyConfig({
	allowedMethods: ["POST"],
	route: "/api/v1/apps",
	ratelimits: {
		max: 2,
		duration: 60,
	},
	auth: {
		required: false,
	},
});

/**
 * Creates a new application to obtain OAuth 2 credentials
 */
export default async (req: Request): Promise<Response> => {
	const { client_name, redirect_uris, scopes, website } = await parseRequest<{
		client_name: string;
		redirect_uris: string;
		scopes: string;
		website: string;
	}>(req);

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
