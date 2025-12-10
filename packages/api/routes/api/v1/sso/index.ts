import { RolePermission } from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { Client, db } from "@versia-server/kit/db";
import { OpenIdLoginFlows } from "@versia-server/kit/tables";
import { randomUUIDv7 } from "bun";
import { sign } from "hono/jwt";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as client from "openid-client";
import { z } from "zod";
import { oauthRedirectUri } from "@/lib";

export default apiRoute((app) => {
    app.get(
        "/api/v1/sso",
        describeRoute({
            summary: "Get linked accounts",
            tags: ["SSO"],
            responses: {
                200: {
                    description: "Linked accounts",
                    content: {
                        "application/json": {
                            schema: resolver(
                                z.array(
                                    z.object({
                                        id: z.string(),
                                        name: z.string(),
                                        icon: z.string().optional(),
                                    }),
                                ),
                            ),
                        },
                    },
                },
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.OAuth],
        }),
        async (context) => {
            const { user } = context.get("auth");

            const linkedAccounts = await user.getLinkedOidcAccounts(
                config.authentication.openid_providers,
            );

            return context.json(
                linkedAccounts.map((account) => ({
                    id: account.id,
                    name: account.name,
                    icon: account.icon,
                })),
                200,
            );
        },
    );

    app.post(
        "/api/v1/sso",
        describeRoute({
            summary: "Link account",
            tags: ["SSO"],
            responses: {
                302: {
                    description: "Redirect to OpenID provider",
                },
                404: {
                    description: "Issuer not found",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.OAuth],
        }),
        validator("json", z.object({ issuer: z.string() }), handleZodError),
        async (context) => {
            const { user } = context.get("auth");

            const { issuer: issuerId } = context.req.valid("json");

            const issuer = config.authentication.openid_providers.find(
                (provider) => provider.id === issuerId,
            );

            if (!issuer) {
                return context.json(
                    {
                        error: `Issuer with ID ${issuerId} not found in instance's OpenID configuration`,
                    },
                    404,
                );
            }

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

            const redirectUri = oauthRedirectUri(
                context.get("config").http.base_url,
                issuerId,
            );

            const application = await Client.insert({
                id:
                    user.id +
                    Buffer.from(
                        crypto.getRandomValues(new Uint8Array(32)),
                    ).toString("base64"),
                name: "Versia",
                redirectUris: [redirectUri.href],
                scopes: ["openid", "profile", "email"],
                secret: "",
            });

            // Store into database
            const newFlow = (
                await db
                    .insert(OpenIdLoginFlows)
                    .values({
                        id: randomUUIDv7(),
                        codeVerifier,
                        state: parameters.state,
                        issuerId,
                        clientId: application.id,
                    })
                    .returning()
            )[0];

            const jwt = await sign(
                {
                    flow: newFlow.id,
                    link: "true",
                    user_id: user.id,
                    exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes expiration
                    iss: config.http.base_url.toString(),
                    iat: Math.floor(Date.now() / 1000),
                },
                config.authentication.key,
            );

            parameters.state = jwt;

            parameters.redirect_uri = `${oauthRedirectUri(
                config.http.base_url,
                issuerId,
            )}`;

            const redirectTo = client.buildAuthorizationUrl(
                oidcConfig,
                parameters,
            );

            return context.redirect(redirectTo);
        },
    );
});
