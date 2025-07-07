import { RolePermission } from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { Application, db } from "@versia-server/kit/db";
import { OpenIdLoginFlows } from "@versia-server/kit/tables";
import { randomUUIDv7 } from "bun";
import { describeRoute, resolver, validator } from "hono-openapi";
import {
    calculatePKCECodeChallenge,
    generateRandomCodeVerifier,
} from "oauth4webapi";
import { z } from "zod/v4";
import {
    oauthDiscoveryRequest,
    oauthRedirectUri,
} from "../../../../plugins/openid/utils.ts";

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

            const authServer = await oauthDiscoveryRequest(new URL(issuer.url));

            const codeVerifier = generateRandomCodeVerifier();

            const redirectUri = oauthRedirectUri(
                context.get("config").http.base_url,
                issuerId,
            );

            const application = await Application.insert({
                id: randomUUIDv7(),
                clientId:
                    user.id +
                    Buffer.from(
                        crypto.getRandomValues(new Uint8Array(32)),
                    ).toString("base64"),
                name: "Versia",
                redirectUri: redirectUri.toString(),
                scopes: "openid profile email",
                secret: "",
            });

            // Store into database
            const newFlow = (
                await db
                    .insert(OpenIdLoginFlows)
                    .values({
                        id: randomUUIDv7(),
                        codeVerifier,
                        issuerId,
                        applicationId: application.id,
                    })
                    .returning()
            )[0];

            const codeChallenge =
                await calculatePKCECodeChallenge(codeVerifier);

            return context.redirect(
                `${authServer.authorization_endpoint}?${new URLSearchParams({
                    client_id: issuer.client_id,
                    redirect_uri: `${redirectUri}?${new URLSearchParams({
                        flow: newFlow.id,
                        link: "true",
                        user_id: user.id,
                    })}`,
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
