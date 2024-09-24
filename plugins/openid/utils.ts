import {
    type AuthorizationServer,
    discoveryRequest,
    processDiscoveryResponse,
} from "oauth4webapi";

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
