import { config } from "@versia-server/config";
import { apiRoute, handleZodError } from "@versia-server/kit/api";
import { Application, db } from "@versia-server/kit/db";
import { OpenIdLoginFlows } from "@versia-server/kit/tables";
import { randomUUIDv7 } from "bun";
import { describeRoute, validator } from "hono-openapi";
import {
    calculatePKCECodeChallenge,
    discoveryRequest,
    generateRandomCodeVerifier,
    processDiscoveryResponse,
} from "oauth4webapi";
import { z } from "zod/v4";
import { oauthRedirectUri } from "../../../plugins/openid/utils.ts";

export default apiRoute((app) => {
    app.get(
        "/oauth/sso",
        describeRoute({
            summary: "Initiate SSO login flow",
            tags: ["OpenID"],
            responses: {
                302: {
                    description:
                        "Redirect to SSO login, or redirect to login page with error",
                },
            },
        }),
        validator(
            "query",
            z.object({
                issuer: z.string(),
                client_id: z.string().optional(),
                redirect_uri: z.url().optional(),
                scope: z.string().optional(),
                response_type: z.enum(["code"]).optional(),
            }),
            handleZodError,
        ),
        async (context) => {
            // This is the Versia client's client_id, not the external OAuth provider's client_id
            const { issuer: issuerId, client_id } = context.req.valid("query");

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

            const issuer = config.authentication.openid_providers.find(
                (provider) => provider.id === issuerId,
            );

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
                        id: randomUUIDv7(),
                        codeVerifier,
                        applicationId: application.id,
                        issuerId,
                    })
                    .returning()
            )[0];

            const codeChallenge =
                await calculatePKCECodeChallenge(codeVerifier);

            return context.redirect(
                `${authServer.authorization_endpoint}?${new URLSearchParams({
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
                }).toString()}`,
            );
        },
    );
});
