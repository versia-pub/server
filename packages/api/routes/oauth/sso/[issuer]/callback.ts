import {
    Account as AccountSchema,
    RolePermission,
    zBoolean,
} from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { apiRoute, handleZodError } from "@versia-server/kit/api";
import { db, Media, User } from "@versia-server/kit/db";
import { searchManager } from "@versia-server/kit/search";
import {
    AuthorizationCodes,
    OpenIdAccounts,
    Users,
} from "@versia-server/kit/tables";
import { randomUUIDv7 } from "bun";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import { setCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { describeRoute, validator } from "hono-openapi";
import * as client from "openid-client";
import { z } from "zod/v4";
import { randomString } from "@/math.ts";

export default apiRoute((app) => {
    app.get(
        "/oauth/sso/:issuer/callback",
        describeRoute({
            summary: "SSO callback",
            tags: ["OpenID"],
            description:
                "After the user has authenticated to an external OpenID provider, they are redirected here to complete the OAuth flow and get a code",
            responses: {
                302: {
                    description:
                        "Redirect to frontend's consent route, or redirect to login page with error",
                },
                422: ApiError.validationFailed().schema,
            },
        }),
        validator(
            "param",
            z.object({
                issuer: z.string(),
            }),
            handleZodError,
        ),
        validator(
            "query",
            z.object({
                flow: z.string(),
                link: zBoolean.default(false),
                user_id: z.uuid().optional(),
            }),
            handleZodError,
        ),
        async (context) => {
            const { issuer: issuerId } = context.req.valid("param");
            const { flow: flowId, user_id, link } = context.req.valid("query");

            const issuer = config.authentication.openid_providers.find(
                (provider) => provider.id === issuerId,
            );

            if (!issuer) {
                throw new ApiError(422, "Unknown or invalid issuer");
            }

            const flow = await db.query.OpenIdLoginFlows.findFirst({
                where: (flow): SQL | undefined => eq(flow.id, flowId),
                with: {
                    client: true,
                },
            });

            const redirectWithMessage = (
                parameters: Record<string, string | undefined>,
                route = config.frontend.routes.login,
            ) => {
                const searchParams = new URLSearchParams(
                    Object.entries(parameters).filter(
                        ([_, value]) => value !== undefined,
                    ) as [string, string][],
                );

                return context.redirect(`${route}?${searchParams.toString()}`);
            };

            if (!flow) {
                return redirectWithMessage({
                    error: "invalid_request",
                    error_description: "Invalid flow",
                });
            }

            const oidcConfig = await client.discovery(
                issuer.url,
                issuer.client_id,
                issuer.client_secret,
            );

            const tokens = await client.authorizationCodeGrant(
                oidcConfig,
                context.req.raw,
                {
                    pkceCodeVerifier: flow.codeVerifier,
                    expectedState: flow.state ?? undefined,
                    idTokenExpected: true,
                },
            );

            const claims = tokens.claims();

            if (!claims) {
                return redirectWithMessage({
                    error: "invalid_request",
                    error_description: "Missing or invalid ID token",
                });
            }

            const userInfo = await client.fetchUserInfo(
                oidcConfig,
                tokens.access_token,
                claims.sub,
            );

            const { sub, email, preferred_username, picture } = userInfo;

            // If linking account
            if (link && user_id) {
                // Check if userId is equal to application.clientId
                if (!flow.client?.id.startsWith(user_id)) {
                    return redirectWithMessage(
                        {
                            oidc_account_linking_error: "Account linking error",
                            oidc_account_linking_error_message: `User ID does not match application client ID (${user_id} != ${flow.client?.id})`,
                        },
                        config.frontend.routes.home,
                    );
                }

                // Check if account is already linked
                const account = await db.query.OpenIdAccounts.findFirst({
                    where: (account): SQL | undefined =>
                        and(
                            eq(account.serverId, sub),
                            eq(account.issuerId, issuer.id),
                        ),
                });

                if (account) {
                    return redirectWithMessage(
                        {
                            oidc_account_linking_error:
                                "Account already linked",
                            oidc_account_linking_error_message:
                                "This account has already been linked to this OpenID Connect provider.",
                        },
                        config.frontend.routes.home,
                    );
                }

                // Link the account
                await db.insert(OpenIdAccounts).values({
                    id: randomUUIDv7(),
                    serverId: sub,
                    issuerId: issuer.id,
                    userId: user_id,
                });

                return context.redirect(
                    `${context.get("config").http.base_url}${
                        context.get("config").frontend.routes.home
                    }?${new URLSearchParams({
                        oidc_account_linked: "true",
                    })}`,
                );
            }

            let userId = (
                await db.query.OpenIdAccounts.findFirst({
                    where: (account): SQL | undefined =>
                        and(
                            eq(account.serverId, sub),
                            eq(account.issuerId, issuer.id),
                        ),
                })
            )?.userId;

            if (!userId) {
                // Register new user
                if (config.authentication.openid_registration) {
                    let username =
                        preferred_username ??
                        email?.split("@")[0] ??
                        randomString(8, "hex");

                    const usernameValidator =
                        AccountSchema.shape.username.refine(
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

                    const avatar = picture
                        ? await Media.fromUrl(new URL(picture))
                        : null;

                    // Create new user
                    const user = await User.register(username, {
                        email: doesEmailExist ? undefined : email,
                        avatar: avatar ?? undefined,
                    });

                    // Add to search index
                    await searchManager.addUser(user);

                    // Link account
                    await db.insert(OpenIdAccounts).values({
                        id: randomUUIDv7(),
                        serverId: sub,
                        issuerId: issuer.id,
                        userId: user.id,
                    });

                    userId = user.id;
                } else {
                    return redirectWithMessage({
                        error: "invalid_request",
                        error_description: "No user found with that account",
                    });
                }
            }

            const user = await User.fromId(userId);

            if (!user) {
                return redirectWithMessage({
                    error: "invalid_request",
                    error_description: "No user found with that account",
                });
            }

            if (!user.hasPermission(RolePermission.OAuth)) {
                return redirectWithMessage({
                    error: "invalid_request",
                    error_description: `User does not have the '${RolePermission.OAuth}' permission`,
                });
            }

            if (!flow.client) {
                throw new ApiError(500, "Application not found");
            }

            const code = randomString(32, "hex");

            await db.insert(AuthorizationCodes).values({
                clientId: flow.client.id,
                code,
                expiresAt: new Date(Date.now() + 60 * 1000).toISOString(), // 1 minute
                redirectUri: flow.clientRedirectUri ?? undefined,
                userId: user.id,
                scopes: flow.clientScopes ?? [],
            });

            const jwt = await sign(
                {
                    sub: user.id,
                    iss: new URL(context.get("config").http.base_url).origin,
                    aud: flow.client.id,
                    exp: Math.floor(Date.now() / 1000) + 60 * 60,
                    iat: Math.floor(Date.now() / 1000),
                    nbf: Math.floor(Date.now() / 1000),
                },
                config.authentication.key,
            );

            // Redirect back to application
            setCookie(context, "jwt", jwt, {
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                path: "/",
                // 2 weeks
                maxAge: 60 * 60 * 24 * 14,
            });

            return redirectWithMessage(
                {
                    redirect_uri: flow.clientRedirectUri ?? undefined,
                    code,
                    client_id: flow.client.id,
                    application: flow.client.name,
                    website: flow.client.website ?? "",
                    scope: flow.clientScopes?.join(" "),
                    state: flow.clientState ?? undefined,
                },
                config.frontend.routes.consent,
            );
        },
    );
});
