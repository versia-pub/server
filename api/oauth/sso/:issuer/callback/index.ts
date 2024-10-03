import { apiRoute, applyConfig } from "@/api";
import { randomString } from "@/math";
import { setCookie } from "@hono/hono/cookie";
import { createRoute } from "@hono/zod-openapi";
import { and, eq, isNull } from "drizzle-orm";
import type { Context } from "hono";
import { SignJWT } from "jose";
import { z } from "zod";
import { TokenType } from "~/classes/functions/token";
import { db } from "~/drizzle/db";
import { RolePermissions, Tokens, Users } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { OAuthManager } from "~/packages/database-interface/oauth";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
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

const route = createRoute({
    method: "get",
    path: "/oauth/sso/{issuer}/callback",
    summary: "SSO callback",
    description:
        "After the user has authenticated to an external OpenID provider, they are redirected here to complete the OAuth flow and get a code",
    request: {
        query: schemas.query,
        params: schemas.param,
    },
    responses: {
        302: {
            description:
                "Redirect to frontend's consent route, or redirect to login page with error",
        },
    },
});

const returnError = (
    context: Context,
    query: object,
    error: string,
    description: string,
) => {
    const searchParams = new URLSearchParams();

    // Add all data that is not undefined except email and password
    for (const [key, value] of Object.entries(query)) {
        if (key !== "email" && key !== "password" && value !== undefined) {
            searchParams.append(key, value);
        }
    }

    searchParams.append("error", error);
    searchParams.append("error_description", description);

    return context.redirect(
        `${config.frontend.routes.login}?${searchParams.toString()}`,
    );
};

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const currentUrl = new URL(context.req.url);
        const redirectUrl = new URL(context.req.url);

        // Correct some reverse proxies incorrectly setting the protocol as http, even if the original request was https
        // Looking at you, Traefik
        if (
            new URL(config.http.base_url).protocol === "https:" &&
            currentUrl.protocol === "http:"
        ) {
            currentUrl.protocol = "https:";
            redirectUrl.protocol = "https:";
        }

        // Remove state query parameter from URL
        currentUrl.searchParams.delete("state");
        redirectUrl.searchParams.delete("state");
        // Remove issuer query parameter from URL (can cause redirect URI mismatches)
        redirectUrl.searchParams.delete("iss");
        redirectUrl.searchParams.delete("code");
        const { issuer: issuerParam } = context.req.valid("param");
        const { flow: flowId, user_id, link } = context.req.valid("query");

        const manager = new OAuthManager(issuerParam);

        const userInfo = await manager.automaticOidcFlow(
            flowId,
            currentUrl,
            redirectUrl,
            (error, message, app) =>
                returnError(
                    context,
                    OAuthManager.processOAuth2Error(app),
                    error,
                    message,
                ),
        );

        if (userInfo instanceof Response) {
            return userInfo;
        }

        const { sub, email, preferred_username, picture } = userInfo.userInfo;
        const flow = userInfo.flow;

        // If linking account
        if (link && user_id) {
            return await manager.linkUser(user_id, context, userInfo);
        }

        let userId = (
            await db.query.OpenIdAccounts.findFirst({
                where: (account, { eq, and }) =>
                    and(
                        eq(account.serverId, sub),
                        eq(account.issuerId, manager.issuer.id),
                    ),
            })
        )?.userId;

        if (!userId) {
            // Register new user
            if (config.signups.registration && config.oidc.allow_registration) {
                let username =
                    preferred_username ??
                    email?.split("@")[0] ??
                    randomString(8, "hex");

                const usernameValidator = z
                    .string()
                    .regex(/^[a-z0-9_]+$/)
                    .min(3)
                    .max(config.validation.max_username_size)
                    .refine(
                        (value) =>
                            !config.validation.username_blacklist.includes(
                                value,
                            ),
                    )
                    .refine((value) =>
                        config.filters.username.some((filter) =>
                            value.match(filter),
                        ),
                    )
                    .refine(
                        async (value) =>
                            !(await User.fromSql(
                                and(
                                    eq(Users.username, value),
                                    isNull(Users.instanceId),
                                ),
                            )),
                    );

                try {
                    await usernameValidator.parseAsync(username);
                } catch {
                    username = randomString(8, "hex");
                }

                const doesEmailExist = email
                    ? !!(await User.fromSql(eq(Users.email, email)))
                    : false;

                // Create new user
                const user = await User.fromDataLocal({
                    email: doesEmailExist ? undefined : email,
                    username,
                    avatar: picture,
                    password: undefined,
                });

                // Link account
                await manager.linkUserInDatabase(user.id, sub);

                userId = user.id;
            } else {
                return returnError(
                    context,
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
        }

        const user = await User.fromId(userId);

        if (!user) {
            return returnError(
                context,
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

        if (!user.hasPermission(RolePermissions.OAuth)) {
            return returnError(
                context,
                {
                    redirect_uri: flow.application?.redirectUri,
                    client_id: flow.application?.clientId,
                    response_type: "code",
                    scope: flow.application?.scopes,
                },
                "invalid_request",
                `User does not have the '${RolePermissions.OAuth}' permission`,
            );
        }

        if (!flow.application) {
            return context.json({ error: "Application not found" }, 500);
        }

        const code = randomString(32, "hex");

        await db.insert(Tokens).values({
            accessToken: randomString(64, "base64url"),
            code,
            scope: flow.application.scopes,
            tokenType: TokenType.Bearer,
            userId: user.id,
            applicationId: flow.application.id,
        });

        // Try and import the key
        const privateKey = await crypto.subtle.importKey(
            "pkcs8",
            Buffer.from(config.oidc.keys?.private ?? "", "base64"),
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
        setCookie(context, "jwt", jwt, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            path: "/",
            maxAge: 60 * 60,
        });

        return context.redirect(
            new URL(
                `${config.frontend.routes.consent}?${new URLSearchParams({
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
        );
    }),
);
