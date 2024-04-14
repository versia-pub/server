import { apiRoute, applyConfig } from "@api";
import { oauthRedirectUri } from "@constants";
import {
    calculatePKCECodeChallenge,
    discoveryRequest,
    generateRandomCodeVerifier,
    processDiscoveryResponse,
} from "oauth4webapi";
import { db } from "~drizzle/db";
import { openIdLoginFlow } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/oauth/authorize-external",
});

/**
 * Redirects the user to the external OAuth provider
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const redirectToLogin = (error: string) =>
        Response.redirect(
            `/oauth/authorize?${new URLSearchParams({
                ...matchedRoute.query,
                error: encodeURIComponent(error),
            }).toString()}`,
            302,
        );

    const issuerId = matchedRoute.query.issuer;

    // This is the Lysand client's client_id, not the external OAuth provider's client_id
    const clientId = matchedRoute.query.clientId;

    if (!clientId || clientId === "undefined") {
        return redirectToLogin("Missing client_id");
    }

    const config = await extraData.configManager.getConfig();

    const issuer = config.oidc.providers.find(
        (provider) => provider.id === issuerId,
    );

    if (!issuer) {
        return redirectToLogin("Invalid issuer");
    }

    const issuerUrl = new URL(issuer.url);

    const authServer = await discoveryRequest(issuerUrl, {
        algorithm: "oidc",
    }).then((res) => processDiscoveryResponse(issuerUrl, res));

    const codeVerifier = generateRandomCodeVerifier();

    const application = await db.query.application.findFirst({
        where: (application, { eq }) => eq(application.clientId, clientId),
    });

    if (!application) {
        return redirectToLogin("Invalid client_id");
    }

    // Store into database
    const newFlow = (
        await db
            .insert(openIdLoginFlow)
            .values({
                codeVerifier,
                applicationId: application.id,
                issuerId,
            })
            .returning()
    )[0];

    const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

    return Response.redirect(
        `${authServer.authorization_endpoint}?${new URLSearchParams({
            client_id: issuer.client_id,
            redirect_uri: `${oauthRedirectUri(issuerId)}?flow=${newFlow.id}`,
            response_type: "code",
            scope: "openid profile email",
            // PKCE
            code_challenge_method: "S256",
            code_challenge: codeChallenge,
        }).toString()}`,
        302,
    );
});
