import { randomBytes } from "node:crypto";
import { applyConfig, auth, handleZodError } from "@api";
import { oauthRedirectUri } from "@constants";
import { zValidator } from "@hono/zod-validator";
import { errorResponse, jsonResponse, redirect, response } from "@response";
import type { Hono } from "hono";
import {
    calculatePKCECodeChallenge,
    discoveryRequest,
    generateRandomCodeVerifier,
    processDiscoveryResponse,
} from "oauth4webapi";
import { z } from "zod";
import { db } from "~drizzle/db";
import { Applications, OpenIdLoginFlows } from "~drizzle/schema";
import { config } from "~packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: true,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/oauth/link",
});

export const schemas = {
    query: z.object({
        issuer: z.string(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth),
        async (context) => {
            const { issuer: issuerId } = context.req.valid("query");
            const { user } = context.req.valid("header");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            const issuer = config.oidc.providers.find(
                (provider) => provider.id === issuerId,
            );

            if (!issuer) {
                return errorResponse(`Issuer ${issuerId} not found`, 404);
            }

            const issuerUrl = new URL(issuer.url);

            const authServer = await discoveryRequest(issuerUrl, {
                algorithm: "oidc",
            }).then((res) => processDiscoveryResponse(issuerUrl, res));

            const codeVerifier = generateRandomCodeVerifier();

            const application = (
                await db
                    .insert(Applications)
                    .values({
                        clientId:
                            user.id + randomBytes(32).toString("base64url"),
                        name: "Lysand",
                        redirectUri: `${oauthRedirectUri(issuerId)}`,
                        scopes: "openid profile email",
                        secret: "",
                    })
                    .returning()
            )[0];

            // Store into database
            const newFlow = (
                await db
                    .insert(OpenIdLoginFlows)
                    .values({
                        codeVerifier,
                        issuerId,
                        applicationId: application.id,
                    })
                    .returning()
            )[0];

            const codeChallenge =
                await calculatePKCECodeChallenge(codeVerifier);

            return jsonResponse({
                link: `${
                    authServer.authorization_endpoint
                }?${new URLSearchParams({
                    client_id: issuer.client_id,
                    redirect_uri: `${oauthRedirectUri(issuerId)}?flow=${
                        newFlow.id
                    }&link=true&user_id=${user.id}`,
                    response_type: "code",
                    scope: "openid profile email",
                    // PKCE
                    code_challenge_method: "S256",
                    code_challenge: codeChallenge,
                }).toString()}`,
            });
        },
    );
