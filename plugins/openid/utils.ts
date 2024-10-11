import { db } from "@versia/kit/db";
import {
    type AuthorizationServer,
    type OAuth2Error,
    type OpenIDTokenEndpointResponse,
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
import type { Application } from "~/classes/functions/application";

export const oauthDiscoveryRequest = (
    issuerUrl: string | URL,
): Promise<AuthorizationServer> => {
    const issuerUrlurl = new URL(issuerUrl);

    return discoveryRequest(issuerUrlurl, {
        algorithm: "oidc",
    }).then((res) => processDiscoveryResponse(issuerUrlurl, res));
};

export const oauthRedirectUri = (baseUrl: string, issuer: string) =>
    new URL(`/oauth/sso/${issuer}/callback`, baseUrl).toString();

const getFlow = (flowId: string) => {
    return db.query.OpenIdLoginFlows.findFirst({
        where: (flow, { eq }) => eq(flow.id, flowId),
        with: {
            application: true,
        },
    });
};

const getAuthServer = (issuerUrl: URL): Promise<AuthorizationServer> => {
    return discoveryRequest(issuerUrl, {
        algorithm: "oidc",
    }).then((res) => processDiscoveryResponse(issuerUrl, res));
};

const getParameters = (
    authServer: AuthorizationServer,
    clientId: string,
    clientSecret: string,
    currentUrl: URL,
): URLSearchParams | OAuth2Error => {
    return validateAuthResponse(
        authServer,
        {
            client_id: clientId,
            client_secret: clientSecret,
        },
        currentUrl,
        expectNoState,
    );
};

const getOIDCResponse = (
    authServer: AuthorizationServer,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    codeVerifier: string,
    parameters: URLSearchParams,
): Promise<Response> => {
    return authorizationCodeGrantRequest(
        authServer,
        {
            client_id: clientId,
            client_secret: clientSecret,
        },
        parameters,
        redirectUri,
        codeVerifier,
    );
};

const processOIDCResponse = (
    authServer: AuthorizationServer,
    clientId: string,
    clientSecret: string,
    oidcResponse: Response,
): Promise<OpenIDTokenEndpointResponse | OAuth2Error> => {
    return processAuthorizationCodeOpenIDResponse(
        authServer,
        {
            client_id: clientId,
            client_secret: clientSecret,
        },
        oidcResponse,
    );
};

const getUserInfo = (
    authServer: AuthorizationServer,
    clientId: string,
    clientSecret: string,
    accessToken: string,
    sub: string,
) => {
    return userInfoRequest(
        authServer,
        {
            client_id: clientId,
            client_secret: clientSecret,
        },
        accessToken,
    ).then(
        async (res) =>
            await processUserInfoResponse(
                authServer,
                {
                    client_id: clientId,
                    client_secret: clientId,
                },
                sub,
                res,
            ),
    );
};

export const automaticOidcFlow = async (
    issuer: {
        url: string;
        client_id: string;
        client_secret: string;
    },
    flowId: string,
    currentUrl: URL,
    redirectUrl: URL,
    errorFn: (
        error: string,
        message: string,
        app: Application | null,
    ) => Response,
) => {
    const flow = await getFlow(flowId);

    if (!flow) {
        return errorFn("invalid_request", "Invalid flow", null);
    }

    const issuerUrl = new URL(issuer.url);

    const authServer = await getAuthServer(issuerUrl);

    const parameters = await getParameters(
        authServer,
        issuer.client_id,
        issuer.client_secret,
        currentUrl,
    );

    if (isOAuth2Error(parameters)) {
        return errorFn(
            parameters.error,
            parameters.error_description || "",
            flow.application,
        );
    }

    const oidcResponse = await getOIDCResponse(
        authServer,
        issuer.client_id,
        issuer.client_secret,
        redirectUrl.toString(),
        flow.codeVerifier,
        parameters,
    );

    const result = await processOIDCResponse(
        authServer,
        issuer.client_id,
        issuer.client_secret,
        oidcResponse,
    );

    if (isOAuth2Error(result)) {
        return errorFn(
            result.error,
            result.error_description || "",
            flow.application,
        );
    }

    const { access_token } = result;

    const claims = getValidatedIdTokenClaims(result);
    const { sub } = claims;

    // Validate `sub`
    // Later, we'll use this to automatically set the user's data
    const userInfo = await getUserInfo(
        authServer,
        issuer.client_id,
        issuer.client_secret,
        access_token,
        sub,
    );

    return {
        userInfo,
        flow,
        claims,
    };
};
