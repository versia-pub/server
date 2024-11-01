import { db } from "@versia/kit/db";
import type { InferSelectModel, SQL } from "@versia/kit/drizzle";
import type { Applications, OpenIdLoginFlows } from "@versia/kit/tables";
import {
    type AuthorizationResponseError,
    type AuthorizationServer,
    ClientSecretPost,
    type ResponseBodyError,
    type TokenEndpointResponse,
    type UserInfoResponse,
    authorizationCodeGrantRequest,
    discoveryRequest,
    expectNoState,
    getValidatedIdTokenClaims,
    processAuthorizationCodeResponse,
    processDiscoveryResponse,
    processUserInfoResponse,
    userInfoRequest,
    validateAuthResponse,
} from "oauth4webapi";
import type { ApplicationType } from "~/classes/database/application";

export const oauthDiscoveryRequest = (
    issuerUrl: string | URL,
): Promise<AuthorizationServer> => {
    const issuerUrlurl = new URL(issuerUrl);

    return discoveryRequest(issuerUrlurl, {
        algorithm: "oidc",
    }).then((res) => processDiscoveryResponse(issuerUrlurl, res));
};

export const oauthRedirectUri = (baseUrl: string, issuer: string): string =>
    new URL(`/oauth/sso/${issuer}/callback`, baseUrl).toString();

const getFlow = (
    flowId: string,
): Promise<
    | (InferSelectModel<typeof OpenIdLoginFlows> & {
          application?: ApplicationType | null;
      })
    | undefined
> => {
    return db.query.OpenIdLoginFlows.findFirst({
        where: (flow, { eq }): SQL | undefined => eq(flow.id, flowId),
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
    redirectUri: string,
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
        redirectUri,
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
                  application?: InferSelectModel<typeof Applications> | null;
              })
            | null,
    ) => Response,
): Promise<
    | Response
    | {
          userInfo: UserInfoResponse;
          flow: InferSelectModel<typeof OpenIdLoginFlows> & {
              application?: ApplicationType | null;
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

        const parameters = await getParameters(
            authServer,
            issuer.client_id,
            currentUrl,
        );

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
