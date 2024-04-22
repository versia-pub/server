import { randomBytes } from "node:crypto";
import { apiRoute, applyConfig } from "@api";
import { oauthRedirectUri } from "@constants";
import {
    authorizationCodeGrantRequest,
    discoveryRequest,
    expectNoState,
    getValidatedIdTokenClaims,
    isOAuth2Error,
    processAuthorizationCodeOpenIDResponse,
    processDiscoveryResponse,
    processUserInfoResponse,
    userInfoRequest,
    validateAuthResponse,
} from "oauth4webapi";
import { TokenType } from "~database/entities/Token";
import { findFirstUser } from "~database/entities/User";
import { db } from "~drizzle/db";
import { Tokens } from "~drizzle/schema";

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
export default apiRoute(async (req, matchedRoute, extraData) => {
    const redirectToLogin = (error: string) =>
        Response.redirect(
            `/oauth/authorize?${new URLSearchParams({
                client_id: matchedRoute.query.clientId,
                error: encodeURIComponent(error),
            }).toString()}`,
            302,
        );

    const currentUrl = new URL(req.url);

    // Remove state query parameter from URL
    currentUrl.searchParams.delete("state");
    const issuerParam = matchedRoute.params.issuer;

    const flow = await db.query.OpenIdLoginFlows.findFirst({
        where: (flow, { eq }) => eq(flow.id, matchedRoute.query.flow),
        with: {
            application: true,
        },
    });

    if (!flow) {
        return redirectToLogin("Invalid flow");
    }

    const config = await extraData.configManager.getConfig();

    const issuer = config.oidc.providers.find(
        (provider) => provider.id === issuerParam,
    );

    if (!issuer) {
        return redirectToLogin("Invalid issuer");
    }

    const issuerUrl = new URL(issuer.url);

    const authServer = await discoveryRequest(issuerUrl, {
        algorithm: "oidc",
    }).then((res) => processDiscoveryResponse(issuerUrl, res));

    const parameters = validateAuthResponse(
        authServer,
        {
            client_id: issuer.client_id,
            client_secret: issuer.client_secret,
        },
        currentUrl,
        // Whether to expect state or not
        expectNoState,
    );

    if (isOAuth2Error(parameters)) {
        return redirectToLogin(
            parameters.error_description || parameters.error,
        );
    }

    const response = await authorizationCodeGrantRequest(
        authServer,
        {
            client_id: issuer.client_id,
            client_secret: issuer.client_secret,
        },
        parameters,
        `${oauthRedirectUri(issuerParam)}?flow=${flow.id}`,
        flow.codeVerifier,
    );

    const result = await processAuthorizationCodeOpenIDResponse(
        authServer,
        {
            client_id: issuer.client_id,
            client_secret: issuer.client_secret,
        },
        response,
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
        access_token,
    ).then((res) =>
        processUserInfoResponse(
            authServer,
            {
                client_id: issuer.client_id,
                client_secret: issuer.client_secret,
            },
            sub,
            res,
        ),
    );

    const userId = (
        await db.query.OpenIdAccounts.findFirst({
            where: (account, { eq, and }) =>
                and(eq(account.serverId, sub), eq(account.issuerId, issuer.id)),
        })
    )?.userId;

    if (!userId) {
        return redirectToLogin("No user found with that account");
    }

    const user = await findFirstUser({
        where: (user, { eq }) => eq(user.id, userId),
    });

    if (!user) {
        return redirectToLogin("No user found with that account");
    }

    if (!flow.application) return redirectToLogin("Invalid client_id");

    const code = randomBytes(32).toString("hex");

    await db.insert(Tokens).values({
        accessToken: randomBytes(64).toString("base64url"),
        code: code,
        scope: flow.application.scopes,
        tokenType: TokenType.BEARER,
        userId: user.id,
        applicationId: flow.application.id,
    });

    // Redirect back to application
    return Response.redirect(
        `/oauth/consent?${new URLSearchParams({
            redirect_uri: flow.application.redirectUri,
            code,
            client_id: flow.application.clientId,
            application: flow.application.name,
            website: flow.application.website ?? "",
            scope: flow.application.scopes,
        }).toString()}`,
        302,
    );
});
