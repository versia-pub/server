import { applyConfig } from "@api";
import { getConfig } from "@config";
import { oauthRedirectUri } from "@constants";
import type { MatchedRoute } from "bun";
import { randomBytes } from "crypto";
import {
	authorizationCodeGrantRequest,
	discoveryRequest,
	expectNoState,
	isOAuth2Error,
	processDiscoveryResponse,
	validateAuthResponse,
	userInfoRequest,
	processAuthorizationCodeOpenIDResponse,
	processUserInfoResponse,
	getValidatedIdTokenClaims,
} from "oauth4webapi";
import { client } from "~database/datasource";
import { TokenType } from "~database/entities/Token";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	auth: {
		required: false,
	},
	ratelimits: {
		duration: 60,
		max: 20,
	},
	route: "/oauth/callback/:issuer",
});

/**
 * Redirects the user to the external OAuth provider
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const redirectToLogin = (error: string) =>
		Response.redirect(
			`/oauth/authorize?` +
				new URLSearchParams({
					client_id: matchedRoute.query.clientId,
					error: encodeURIComponent(error),
				}).toString(),
			302
		);

	const currentUrl = new URL(req.url);

	// Remove state query parameter from URL
	currentUrl.searchParams.delete("state");
	const issuerParam = matchedRoute.params.issuer;
	// This is the Lysand client's client_id, not the external OAuth provider's client_id
	const clientId = matchedRoute.query.clientId;

	const config = getConfig();

	const issuer = config.oidc.providers.find(
		provider => provider.id === issuerParam
	);

	if (!issuer) {
		return redirectToLogin("Invalid issuer");
	}

	const issuerUrl = new URL(issuer.url);

	const authServer = await discoveryRequest(issuerUrl, {
		algorithm: "oidc",
	}).then(res => processDiscoveryResponse(issuerUrl, res));

	const parameters = validateAuthResponse(
		authServer,
		{
			client_id: issuer.client_id,
			client_secret: issuer.client_secret,
		},
		currentUrl,
		// Whether to expect state or not
		expectNoState
	);

	if (isOAuth2Error(parameters)) {
		return redirectToLogin(
			parameters.error_description || parameters.error
		);
	}

	const response = await authorizationCodeGrantRequest(
		authServer,
		{
			client_id: issuer.client_id,
			client_secret: issuer.client_secret,
		},
		parameters,
		oauthRedirectUri(issuerParam) + `?clientId=${clientId}`,
		"tempString"
	);

	const result = await processAuthorizationCodeOpenIDResponse(
		authServer,
		{
			client_id: issuer.client_id,
			client_secret: issuer.client_secret,
		},
		response
	);

	if (isOAuth2Error(result)) {
		return redirectToLogin(result.error_description || result.error);
	}

	const { access_token } = result;

	const claims = getValidatedIdTokenClaims(result);
	const { sub } = claims;

	// Validate `sub`
	// Later, we'll use this to automatically set the user's data
	await userInfoRequest(
		authServer,
		{
			client_id: issuer.client_id,
			client_secret: issuer.client_secret,
		},
		access_token
	).then(res =>
		processUserInfoResponse(
			authServer,
			{
				client_id: issuer.client_id,
				client_secret: issuer.client_secret,
			},
			sub,
			res
		)
	);

	const user = await client.user.findFirst({
		where: {
			linkedOpenIdAccounts: {
				some: {
					serverId: sub,
					issuerId: issuer.id,
				},
			},
		},
	});

	if (!user) {
		return redirectToLogin("No user found with that account");
	}

	const application = await client.application.findFirst({
		where: {
			client_id: clientId,
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
					scope: application.scopes,
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
	return Response.redirect(`${application.redirect_uris}?code=${code}`, 302);
};
