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
    const flow = await client.openIdLoginFlow.findFirst({
        where: {
            id: matchedRoute.query.flow,
        },
        include: {
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

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!flow.application) return redirectToLogin("Invalid client_id");

    const code = randomBytes(32).toString("hex");

    await client.application.update({
        where: { id: flow.application.id },
        data: {
            tokens: {
                create: {
                    access_token: randomBytes(64).toString("base64url"),
                    code: code,
                    scope: flow.application.scopes,
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
    return Response.redirect(
        `/oauth/redirect?${new URLSearchParams({
            redirect_uri: flow.application.redirect_uris,
            code,
            client_id: flow.application.client_id,
            application: flow.application.name,
            website: flow.application.website ?? "",
            scope: flow.application.scopes,
        }).toString()}`,
        302,
    );
});
