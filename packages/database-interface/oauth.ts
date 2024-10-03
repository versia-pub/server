import type { InferInsertModel } from "drizzle-orm";
import type { Context } from "hono";
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
import type { Application } from "~/classes/functions/application";
import { db } from "~/drizzle/db";
import { type Applications, OpenIdAccounts } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";

export class OAuthManager {
    public issuer: (typeof config.oidc.providers)[0];

    constructor(public issuerId: string) {
        const found = config.oidc.providers.find(
            (provider) => provider.id === this.issuerId,
        );

        if (!found) {
            throw new Error(`Issuer ${this.issuerId} not found`);
        }

        this.issuer = found;
    }

    static async getFlow(flowId: string) {
        return await db.query.OpenIdLoginFlows.findFirst({
            where: (flow, { eq }) => eq(flow.id, flowId),
            with: {
                application: true,
            },
        });
    }

    static async getAuthServer(issuerUrl: URL) {
        return await discoveryRequest(issuerUrl, {
            algorithm: "oidc",
        }).then((res) => processDiscoveryResponse(issuerUrl, res));
    }

    static getParameters(
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

    static async getOIDCResponse(
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

    static async processOIDCResponse(
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

    static async getUserInfo(
        authServer: AuthorizationServer,
        issuer: (typeof config.oidc.providers)[0],
        accessToken: string,
        sub: string,
    ) {
        return await userInfoRequest(
            authServer,
            {
                client_id: issuer.client_id,
                client_secret: issuer.client_secret,
            },
            accessToken,
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

    static processOAuth2Error(
        application: InferInsertModel<typeof Applications> | null,
    ) {
        return {
            redirect_uri: application?.redirectUri,
            client_id: application?.clientId,
            response_type: "code",
            scope: application?.scopes,
        };
    }

    async linkUserInDatabase(userId: string, sub: string): Promise<void> {
        await db.insert(OpenIdAccounts).values({
            serverId: sub,
            issuerId: this.issuer.id,
            userId,
        });
    }

    async linkUser(
        userId: string,
        context: Context,
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
        if (!flow.application?.clientId.startsWith(userId)) {
            return context.redirect(
                `${config.http.base_url}${
                    config.frontend.routes.home
                }?${new URLSearchParams({
                    oidc_account_linking_error: "Account linking error",
                    oidc_account_linking_error_message: `User ID does not match application client ID (${userId} != ${flow.application?.clientId})`,
                })}`,
            );
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
            return context.redirect(
                `${config.http.base_url}${
                    config.frontend.routes.home
                }?${new URLSearchParams({
                    oidc_account_linking_error: "Account already linked",
                    oidc_account_linking_error_message:
                        "This account has already been linked to this OpenID Connect provider.",
                })}`,
            );
        }

        // Link the account
        await this.linkUserInDatabase(userId, userInfo.sub);

        return context.redirect(
            `${config.http.base_url}${
                config.frontend.routes.home
            }?${new URLSearchParams({
                oidc_account_linked: "true",
            })}`,
        );
    }

    async automaticOidcFlow(
        flowId: string,
        currentUrl: URL,
        redirectUrl: URL,
        errorFn: (
            error: string,
            message: string,
            app: Application | null,
        ) => Response,
    ) {
        const flow = await OAuthManager.getFlow(flowId);

        if (!flow) {
            return errorFn("invalid_request", "Invalid flow", null);
        }

        const issuerUrl = new URL(this.issuer.url);

        const authServer = await OAuthManager.getAuthServer(issuerUrl);

        const parameters = await OAuthManager.getParameters(
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

        const oidcResponse = await OAuthManager.getOIDCResponse(
            authServer,
            this.issuer,
            redirectUrl.toString(),
            flow.codeVerifier,
            parameters,
        );

        const result = await OAuthManager.processOIDCResponse(
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
        const userInfo = await OAuthManager.getUserInfo(
            authServer,
            this.issuer,
            access_token,
            sub,
        );

        return {
            userInfo,
            flow,
            claims,
        };
    }
}
