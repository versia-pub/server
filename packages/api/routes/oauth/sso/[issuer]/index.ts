import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { apiRoute, handleZodError, jsonOrForm } from "@versia-server/kit/api";
import { Client, db } from "@versia-server/kit/db";
import { OpenIdLoginFlows } from "@versia-server/kit/tables";
import { randomUUIDv7 } from "bun";
import { describeRoute, validator } from "hono-openapi";
import * as client from "openid-client";
import { z } from "zod";
import { oauthRedirectUri } from "@/lib";

export default apiRoute((app) => {
    app.post(
        "/oauth/sso/:issuer",
        describeRoute({
            summary: "Initiate SSO login flow",
            tags: ["OpenID"],
            responses: {
                302: {
                    description:
                        "Redirect to SSO provider's authorization endpoint",
                },
                422: ApiError.validationFailed().schema,
            },
        }),
        jsonOrForm(),
        validator(
            "param",
            z.object({
                issuer: z.string(),
            }),
            handleZodError,
        ),
        validator(
            "json",
            z.object({
                client_id: z.string(),
                redirect_uri: z.url(),
                scopes: z.string().array().default(["read"]),
                state: z.string().optional(),
            }),
            handleZodError,
        ),
        async (context) => {
            // This is the Versia client's client_id, not the external OAuth provider's client_id
            const { client_id, redirect_uri, scopes, state } =
                context.req.valid("json");
            const { issuer: issuerId } = context.req.valid("param");

            const issuer = config.authentication.openid_providers.find(
                (provider) => provider.id === issuerId,
            );

            if (!issuer) {
                throw new ApiError(422, "Unknown or invalid issuer");
            }

            const application = await Client.fromClientId(client_id);

            if (!application) {
                throw new ApiError(422, "Unknown or invalid client_id");
            }

            if (!application.data.redirectUris.includes(redirect_uri)) {
                throw new ApiError(
                    422,
                    "redirect_uri is not a subset of application's redirect_uris",
                );
            }
            // TODO: Validate oauth scopes

            const oidcConfig = await client.discovery(
                issuer.url,
                issuer.client_id,
                issuer.client_secret,
            );
            const codeVerifier = client.randomPKCECodeVerifier();
            const codeChallenge =
                await client.calculatePKCECodeChallenge(codeVerifier);

            const parameters: Record<string, string> = {
                scope: "openid profile email",
                code_challenge: codeChallenge,
                code_challenge_method: "S256",
            };

            if (!oidcConfig.serverMetadata().supportsPKCE()) {
                parameters.state = client.randomState();
            }

            // Store into database
            const newFlow = (
                await db
                    .insert(OpenIdLoginFlows)
                    .values({
                        id: randomUUIDv7(),
                        codeVerifier,
                        state: parameters.state,
                        clientState: state,
                        clientRedirectUri: redirect_uri,
                        clientScopes: scopes,
                        clientId: application.id,
                        issuerId,
                    })
                    .returning()
            )[0];

            parameters.redirect_uri = `${oauthRedirectUri(
                context.get("config").http.base_url,
                issuerId,
            )}?${new URLSearchParams({
                flow: newFlow.id,
            })}`;

            const redirectTo = client.buildAuthorizationUrl(
                oidcConfig,
                parameters,
            );

            return context.redirect(redirectTo);
        },
    );
});
