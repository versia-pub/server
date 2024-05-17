import { oauthRedirectUri } from "@constants";
import { errorResponse, response } from "@response";
import type { InferInsertModel } from "drizzle-orm";
import {
    type AuthorizationServer,
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
import type { Application } from "~database/entities/Application";
import { db } from "~drizzle/db";
import { type Applications, OpenIdAccounts } from "~drizzle/schema";
import { config } from "~packages/config-manager";

export class OAuthManager {
    public issuer: (typeof config.oidc.providers)[0];

    constructor(public issuer_id: string) {
        const found = config.oidc.providers.find(
            (provider) => provider.id === this.issuer_id,
        );

        if (!found) {
            throw new Error(`Issuer ${this.issuer_id} not found`);
        }

        this.issuer = found;
    }

    async getFlow(flowId: string) {
        return await db.query.OpenIdLoginFlows.findFirst({
            where: (flow, { eq }) => eq(flow.id, flowId),
            with: {
                application: true,
            },
        });
    }

    async getAuthServer(issuerUrl: URL) {
        return await discoveryRequest(issuerUrl, {
            algorithm: "oidc",
        }).then((res) => processDiscoveryResponse(issuerUrl, res));
    }

    async getParameters(
        authServer: AuthorizationServer,
        issuer: (typeof config.oidc.providers)[0],
        currentUrl: URL,
    ) {
        return validateAuthResponse(
            authServer,
            {
                client_id: issuer.client_id,
                client_secret: issuer.client_secret,
            },
            currentUrl,
            expectNoState,
        );
    }

    async getOIDCResponse(
        authServer: AuthorizationServer,
        issuer: (typeof config.oidc.providers)[0],
        redirectUri: string,
        codeVerifier: string,
        parameters: URLSearchParams,
    ) {
        return await authorizationCodeGrantRequest(
            authServer,
            {
                client_id: issuer.client_id,
                client_secret: issuer.client_secret,
            },
            parameters,
            redirectUri,
            codeVerifier,
        );
    }

    async processOIDCResponse(
        authServer: AuthorizationServer,
        issuer: (typeof config.oidc.providers)[0],
        oidcResponse: Response,
    ) {
        return await processAuthorizationCodeOpenIDResponse(
            authServer,
            {
                client_id: issuer.client_id,
                client_secret: issuer.client_secret,
            },
            oidcResponse,
        );
    }

    async getUserInfo(
        authServer: AuthorizationServer,
        issuer: (typeof config.oidc.providers)[0],
        access_token: string,
        sub: string,
    ) {
        return await userInfoRequest(
            authServer,
            {
                client_id: issuer.client_id,
                client_secret: issuer.client_secret,
            },
            access_token,
        ).then(
            async (res) =>
                await processUserInfoResponse(
                    authServer,
                    {
                        client_id: issuer.client_id,
                        client_secret: issuer.client_secret,
                    },
                    sub,
                    res,
                ),
        );
    }

    async processOAuth2Error(
        application: InferInsertModel<typeof Applications> | null,
    ) {
        return {
            redirect_uri: application?.redirectUri,
            client_id: application?.clientId,
            response_type: "code",
            scope: application?.scopes,
        };
    }

    async linkUser(
        userId: string,
        // Return value of automaticOidcFlow
        oidcFlowData: Exclude<
            Awaited<
                ReturnType<typeof OAuthManager.prototype.automaticOidcFlow>
            >,
            Response
        >,
    ) {
        const { flow, userInfo } = oidcFlowData;

        // Check if userId is equal to application.clientId
        if ((flow.application?.clientId ?? "") !== userId) {
            return response(null, 302, {
                Location: `${config.http.base_url}${
                    config.frontend.routes.home
                }?${new URLSearchParams({
                    oidc_account_linking_error: "Account linking error",
                    oidc_account_linking_error_message: `User ID does not match application client ID (${userId} != ${flow.application?.clientId})`,
                })}`,
            });
        }

        // Check if account is already linked
        const account = await db.query.OpenIdAccounts.findFirst({
            where: (account, { eq, and }) =>
                and(
                    eq(account.serverId, userInfo.sub),
                    eq(account.issuerId, this.issuer.id),
                ),
        });

        if (account) {
            return response(null, 302, {
                Location: `${config.http.base_url}${
                    config.frontend.routes.home
                }?${new URLSearchParams({
                    oidc_account_linking_error: "Account already linked",
                    oidc_account_linking_error_message:
                        "This account has already been linked to this OpenID Connect provider.",
                })}`,
            });
        }

        // Link the account
        await db.insert(OpenIdAccounts).values({
            serverId: userInfo.sub,
            issuerId: this.issuer.id,
            userId: userId,
        });

        return response(null, 302, {
            Location: `${config.http.base_url}${
                config.frontend.routes.home
            }?${new URLSearchParams({
                oidc_account_linked: "true",
            })}`,
        });
    }

    async automaticOidcFlow(
        flowId: string,
        currentUrl: URL,
        errorFn: (
            error: string,
            message: string,
            app: Application | null,
        ) => Response,
    ) {
        const flow = await this.getFlow(flowId);

        if (!flow) {
            return errorFn("invalid_request", "Invalid flow", null);
        }

        const issuerUrl = new URL(this.issuer.url);

        const authServer = await this.getAuthServer(issuerUrl);

        const parameters = await this.getParameters(
            authServer,
            this.issuer,
            currentUrl,
        );

        if (isOAuth2Error(parameters)) {
            return errorFn(
                parameters.error,
                parameters.error_description || "",
                flow.application,
            );
        }

        const oidcResponse = await this.getOIDCResponse(
            authServer,
            this.issuer,
            `${oauthRedirectUri(this.issuer.id)}?flow=${flow.id}`,
            flow.codeVerifier,
            parameters,
        );

        const result = await this.processOIDCResponse(
            authServer,
            this.issuer,
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
        const userInfo = await this.getUserInfo(
            authServer,
            this.issuer,
            access_token,
            sub,
        );

        return {
            userInfo: userInfo,
            flow: flow,
            claims: claims,
        };
    }
}
