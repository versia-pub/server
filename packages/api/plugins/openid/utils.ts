import { type Application, db } from "@versia-server/kit/db";
import type { OpenIdLoginFlows } from "@versia-server/kit/tables";
import { eq, type InferSelectModel, type SQL } from "drizzle-orm";
import {
    type AuthorizationResponseError,
    type AuthorizationServer,
    authorizationCodeGrantRequest,
    ClientSecretPost,
    discoveryRequest,
    expectNoState,
    getValidatedIdTokenClaims,
    processAuthorizationCodeResponse,
    processDiscoveryResponse,
    processUserInfoResponse,
    type ResponseBodyError,
    type TokenEndpointResponse,
    type UserInfoResponse,
    userInfoRequest,
    validateAuthResponse,
} from "oauth4webapi";

export const oauthDiscoveryRequest = (
    issuerUrl: URL,
): Promise<AuthorizationServer> => {
    return discoveryRequest(issuerUrl, {
        algorithm: "oidc",
    }).then((res) => processDiscoveryResponse(issuerUrl, res));
};

export const oauthRedirectUri = (baseUrl: URL, issuer: string): URL =>
    new URL(`/oauth/sso/${issuer}/callback`, baseUrl);

const getFlow = (
    flowId: string,
): Promise<
    | (InferSelectModel<typeof OpenIdLoginFlows> & {
          application?: typeof Application.$type | null;
      })
    | undefined
> => {
    return db.query.OpenIdLoginFlows.findFirst({
        where: (flow): SQL | undefined => eq(flow.id, flowId),
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
    currentUrl: URL,
): URLSearchParams => {
    return validateAuthResponse(
        authServer,
        {
            client_id: clientId,
        },
        currentUrl,
        expectNoState,
    );
};

const getOIDCResponse = (
    authServer: AuthorizationServer,
    clientId: string,
    clientSecret: string,
    redirectUri: URL,
    codeVerifier: string,
    parameters: URLSearchParams,
): Promise<Response> => {
    return authorizationCodeGrantRequest(
        authServer,
        {
            client_id: clientId,
        },
        ClientSecretPost(clientSecret),
        parameters,
        redirectUri.toString(),
        codeVerifier,
    );
};

const processOIDCResponse = (
    authServer: AuthorizationServer,
    clientId: string,
    oidcResponse: Response,
): Promise<TokenEndpointResponse> => {
    return processAuthorizationCodeResponse(
        authServer,
        {
            client_id: clientId,
        },
        oidcResponse,
    );
};

const getUserInfo = (
    authServer: AuthorizationServer,
    clientId: string,
    accessToken: string,
    sub: string,
): Promise<UserInfoResponse> => {
    return userInfoRequest(
        authServer,
        {
            client_id: clientId,
        },
        accessToken,
    ).then(
        async (res) =>
            await processUserInfoResponse(
                authServer,
                {
                    client_id: clientId,
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
        flow:
            | (InferSelectModel<typeof OpenIdLoginFlows> & {
                  application?: typeof Application.$type | null;
              })
            | null,
    ) => Response,
): Promise<
    | Response
    | {
          userInfo: UserInfoResponse;
          flow: InferSelectModel<typeof OpenIdLoginFlows> & {
              application?: typeof Application.$type | null;
          };
          claims: Record<string, unknown>;
      }
> => {
    const flow = await getFlow(flowId);

    if (!flow) {
        return errorFn("invalid_request", "Invalid flow", null);
    }

    try {
        const issuerUrl = new URL(issuer.url);

        const authServer = await getAuthServer(issuerUrl);

        const parameters = getParameters(
            authServer,
            issuer.client_id,
            currentUrl,
        );

        const oidcResponse = await getOIDCResponse(
            authServer,
            issuer.client_id,
            issuer.client_secret,
            redirectUrl,
            flow.codeVerifier,
            parameters,
        );

        const result = await processOIDCResponse(
            authServer,
            issuer.client_id,
            oidcResponse,
        );

        const { access_token } = result;

        const claims = getValidatedIdTokenClaims(result);

        if (!claims) {
            return errorFn("invalid_request", "Invalid claims", flow);
        }

        const { sub } = claims;

        // Validate `sub`
        // Later, we'll use this to automatically set the user's data
        const userInfo = await getUserInfo(
            authServer,
            issuer.client_id,
            access_token,
            sub,
        );

        return {
            userInfo,
            flow,
            claims,
        };
    } catch (e) {
        const error = e as ResponseBodyError | AuthorizationResponseError;
        return errorFn(error.error, error.error_description || "", flow);
    }
};
