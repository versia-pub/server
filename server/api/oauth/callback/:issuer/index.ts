import { randomBytes } from "node:crypto";
import { applyConfig, handleZodError } from "@api";
import { oauthRedirectUri } from "@constants";
import { zValidator } from "@hono/zod-validator";
import { response } from "@response";
import type { Hono } from "hono";
import {
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
import { z } from "zod";
import { TokenType } from "~database/entities/Token";
import { db } from "~drizzle/db";
import { Tokens } from "~drizzle/schema";
import { config } from "~packages/config-manager";
import { User } from "~packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/oauth/callback/:issuer",
});

export const schemas = {
    query: z.object({
        clientId: z.string().optional(),
        flow: z.string(),
    }),
    param: z.object({
        issuer: z.string(),
    }),
};

const returnError = (query: object, error: string, description: string) => {
    const searchParams = new URLSearchParams();

    // Add all data that is not undefined except email and password
    for (const [key, value] of Object.entries(query)) {
        if (key !== "email" && key !== "password" && value !== undefined)
            searchParams.append(key, value);
    }

    searchParams.append("error", error);
    searchParams.append("error_description", description);

    return response(null, 302, {
        Location: `/oauth/authorize?${searchParams.toString()}`,
    });
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        zValidator("param", schemas.param, handleZodError),
        async (context) => {
            const currentUrl = new URL(context.req.url);

            // Remove state query parameter from URL
            currentUrl.searchParams.delete("state");
            const { issuer: issuerParam } = context.req.valid("param");
            const { flow: flowId, clientId } = context.req.valid("query");

            const flow = await db.query.OpenIdLoginFlows.findFirst({
                where: (flow, { eq }) => eq(flow.id, flowId),
                with: {
                    application: true,
                },
            });

            if (!flow) {
                return returnError(
                    context.req.query(),
                    "invalid_request",
                    "Invalid flow",
                );
            }

            const issuer = config.oidc.providers.find(
                (provider) => provider.id === issuerParam,
            );

            if (!issuer) {
                return returnError(
                    context.req.query(),
                    "invalid_request",
                    "Invalid issuer",
                );
            }

            const issuerUrl = new URL(issuer.url);

            const authServer = await discoveryRequest(issuerUrl, {
                algorithm: "oidc",
            }).then((res) => processDiscoveryResponse(issuerUrl, res));

            const parameters = validateAuthResponse(
                authServer,
                {
                    client_id: issuer.client_id,
                    client_secret: issuer.client_secret,
                },
                currentUrl,
                // Whether to expect state or not
                expectNoState,
            );

            if (isOAuth2Error(parameters)) {
                return returnError(
                    context.req.query(),
                    parameters.error,
                    parameters.error_description || "",
                );
            }

            const response = await authorizationCodeGrantRequest(
                authServer,
                {
                    client_id: issuer.client_id,
                    client_secret: issuer.client_secret,
                },
                parameters,
                `${oauthRedirectUri(issuerParam)}?flow=${flow.id}`,
                flow.codeVerifier,
            );

            const result = await processAuthorizationCodeOpenIDResponse(
                authServer,
                {
                    client_id: issuer.client_id,
                    client_secret: issuer.client_secret,
                },
                response,
            );

            if (isOAuth2Error(result)) {
                return returnError(
                    context.req.query(),
                    result.error,
                    result.error_description || "",
                );
            }

            const { access_token } = result;

            const claims = getValidatedIdTokenClaims(result);
            const { sub } = claims;

            // Validate `sub`
            // Later, we'll use this to automatically set the user's data
            await userInfoRequest(
                authServer,
                {
                    client_id: issuer.client_id,
                    client_secret: issuer.client_secret,
                },
                access_token,
            ).then((res) =>
                processUserInfoResponse(
                    authServer,
                    {
                        client_id: issuer.client_id,
                        client_secret: issuer.client_secret,
                    },
                    sub,
                    res,
                ),
            );

            const userId = (
                await db.query.OpenIdAccounts.findFirst({
                    where: (account, { eq, and }) =>
                        and(
                            eq(account.serverId, sub),
                            eq(account.issuerId, issuer.id),
                        ),
                })
            )?.userId;

            if (!userId) {
                return returnError(
                    context.req.query(),
                    "invalid_request",
                    "No user found with that account",
                );
            }

            const user = await User.fromId(userId);

            if (!user) {
                return returnError(
                    context.req.query(),
                    "invalid_request",
                    "No user found with that account",
                );
            }

            if (!flow.application)
                return returnError(
                    context.req.query(),
                    "invalid_request",
                    "No application found",
                );

            const code = randomBytes(32).toString("hex");

            await db.insert(Tokens).values({
                accessToken: randomBytes(64).toString("base64url"),
                code: code,
                scope: flow.application.scopes,
                tokenType: TokenType.BEARER,
                userId: user.id,
                applicationId: flow.application.id,
            });

            // Redirect back to application
            return Response.redirect(
                `/oauth/consent?${new URLSearchParams({
                    redirect_uri: flow.application.redirectUri,
                    code,
                    client_id: flow.application.clientId,
                    application: flow.application.name,
                    website: flow.application.website ?? "",
                    scope: flow.application.scopes,
                }).toString()}`,
                302,
            );
        },
    );
