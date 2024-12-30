import { createRoute, z } from "@hono/zod-openapi";
import { Application, db } from "@versia/kit/db";
import { OpenIdLoginFlows } from "@versia/kit/tables";
import {
    calculatePKCECodeChallenge,
    discoveryRequest,
    generateRandomCodeVerifier,
    processDiscoveryResponse,
} from "oauth4webapi";
import type { PluginType } from "../../index.ts";
import { oauthRedirectUri } from "../../utils.ts";

const schemas = {
    query: z.object({
        issuer: z.string(),
        client_id: z.string().optional(),
        redirect_uri: z.string().url().optional(),
        scope: z.string().optional(),
        response_type: z.enum(["code"]).optional(),
    }),
};

export default (plugin: PluginType): void => {
    plugin.registerRoute("/oauth/sso", (app) => {
        app.openapi(
            createRoute({
                method: "get",
                path: "/oauth/sso",
                summary: "Initiate SSO login flow",
                request: {
                    query: schemas.query,
                },
                middleware: [plugin.middleware] as const,
                responses: {
                    302: {
                        description:
                            "Redirect to SSO login, or redirect to login page with error",
                    },
                },
            }),
            async (context) => {
                // This is the Versia client's client_id, not the external OAuth provider's client_id
                const { issuer: issuerId, client_id } =
                    context.req.valid("query");

                const errorSearchParams = new URLSearchParams(
                    context.req.valid("query"),
                );

                if (!client_id || client_id === "undefined") {
                    errorSearchParams.append("error", "invalid_request");
                    errorSearchParams.append(
                        "error_description",
                        "client_id is required",
                    );

                    return context.redirect(
                        `${context.get("config").frontend.routes.login}?${errorSearchParams.toString()}`,
                    );
                }

                const issuer = context
                    .get("pluginConfig")
                    .providers.find((provider) => provider.id === issuerId);

                if (!issuer) {
                    errorSearchParams.append("error", "invalid_request");
                    errorSearchParams.append(
                        "error_description",
                        "issuer is invalid",
                    );

                    return context.redirect(
                        `${context.get("config").frontend.routes.login}?${errorSearchParams.toString()}`,
                    );
                }

                const issuerUrl = new URL(issuer.url);

                const authServer = await discoveryRequest(issuerUrl, {
                    algorithm: "oidc",
                }).then((res) => processDiscoveryResponse(issuerUrl, res));

                const codeVerifier = generateRandomCodeVerifier();

                const application = await Application.fromClientId(client_id);

                if (!application) {
                    errorSearchParams.append("error", "invalid_request");
                    errorSearchParams.append(
                        "error_description",
                        "client_id is invalid",
                    );

                    return context.redirect(
                        `${context.get("config").frontend.routes.login}?${errorSearchParams.toString()}`,
                    );
                }

                // Store into database
                const newFlow = (
                    await db
                        .insert(OpenIdLoginFlows)
                        .values({
                            codeVerifier,
                            applicationId: application.id,
                            issuerId,
                        })
                        .returning()
                )[0];

                const codeChallenge =
                    await calculatePKCECodeChallenge(codeVerifier);

                return context.redirect(
                    `${authServer.authorization_endpoint}?${new URLSearchParams(
                        {
                            client_id: issuer.client_id,
                            redirect_uri: `${oauthRedirectUri(
                                context.get("config").http.base_url,
                                issuerId,
                            )}?flow=${newFlow.id}`,
                            response_type: "code",
                            scope: "openid profile email",
                            // PKCE
                            code_challenge_method: "S256",
                            code_challenge: codeChallenge,
                        },
                    ).toString()}`,
                );
            },
        );
    });
};
