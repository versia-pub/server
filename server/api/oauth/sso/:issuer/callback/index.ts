import { randomBytes } from "node:crypto";
import { applyConfig, handleZodError } from "@api";
import { zValidator } from "@hono/zod-validator";
import { errorResponse, response } from "@response";
import type { Hono } from "hono";
import { SignJWT } from "jose";
import { z } from "zod";
import { TokenType } from "~database/entities/Token";
import { db } from "~drizzle/db";
import { Tokens } from "~drizzle/schema";
import { config } from "~packages/config-manager";
import { OAuthManager } from "~packages/database-interface/oauth";
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
    route: "/oauth/sso/:issuer/callback",
});

export const schemas = {
    query: z.object({
        client_id: z.string().optional(),
        flow: z.string(),
        link: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        user_id: z.string().uuid().optional(),
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

/**
 * OAuth Callback endpoint
 * After the user has authenticated to an external OpenID provider,
 * they are redirected here to complete the OAuth flow and get a code
 */
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
            const { flow: flowId, user_id, link } = context.req.valid("query");

            const manager = new OAuthManager(issuerParam);

            const userInfo = await manager.automaticOidcFlow(
                flowId,
                currentUrl,
                (error, message, app) =>
                    returnError(
                        {
                            ...manager.processOAuth2Error(app),
                            link: link ? "true" : undefined,
                        },
                        error,
                        message,
                    ),
            );

            if (userInfo instanceof Response) return userInfo;

            const { sub } = userInfo.userInfo;
            const flow = userInfo.flow;

            // If linking account
            if (link && user_id) {
                return await manager.linkUser(user_id, userInfo);
            }

            const userId = (
                await db.query.OpenIdAccounts.findFirst({
                    where: (account, { eq, and }) =>
                        and(
                            eq(account.serverId, sub),
                            eq(account.issuerId, manager.issuer.id),
                        ),
                })
            )?.userId;

            if (!userId) {
                return returnError(
                    {
                        redirect_uri: flow.application?.redirectUri,
                        client_id: flow.application?.clientId,
                        response_type: "code",
                        scope: flow.application?.scopes,
                    },
                    "invalid_request",
                    "No user found with that account",
                );
            }

            const user = await User.fromId(userId);

            if (!user) {
                return returnError(
                    {
                        redirect_uri: flow.application?.redirectUri,
                        client_id: flow.application?.clientId,
                        response_type: "code",
                        scope: flow.application?.scopes,
                    },
                    "invalid_request",
                    "No user found with that account",
                );
            }

            if (!flow.application)
                return errorResponse("Application not found", 500);

            const code = randomBytes(32).toString("hex");

            await db.insert(Tokens).values({
                accessToken: randomBytes(64).toString("base64url"),
                code: code,
                scope: flow.application.scopes,
                tokenType: TokenType.BEARER,
                userId: user.id,
                applicationId: flow.application.id,
            });

            // Try and import the key
            const privateKey = await crypto.subtle.importKey(
                "pkcs8",
                Buffer.from(config.oidc.jwt_key.split(";")[0], "base64"),
                "Ed25519",
                false,
                ["sign"],
            );

            // Generate JWT
            const jwt = await new SignJWT({
                sub: user.id,
                iss: new URL(config.http.base_url).origin,
                aud: flow.application.clientId,
                exp: Math.floor(Date.now() / 1000) + 60 * 60,
                iat: Math.floor(Date.now() / 1000),
                nbf: Math.floor(Date.now() / 1000),
            })
                .setProtectedHeader({ alg: "EdDSA" })
                .sign(privateKey);

            // Redirect back to application
            return response(null, 302, {
                Location: new URL(
                    `/oauth/consent?${new URLSearchParams({
                        redirect_uri: flow.application.redirectUri,
                        code,
                        client_id: flow.application.clientId,
                        application: flow.application.name,
                        website: flow.application.website ?? "",
                        scope: flow.application.scopes,
                        response_type: "code",
                    }).toString()}`,
                    config.http.base_url,
                ).toString(),
                // Set cookie with JWT
                "Set-Cookie": `jwt=${jwt}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${
                    60 * 60
                }`,
            });
        },
    );
