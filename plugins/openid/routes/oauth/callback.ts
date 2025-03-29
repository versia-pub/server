import { handleZodError } from "@/api";
import { randomString } from "@/math.ts";
import { Account as AccountSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Media, Token, User, db } from "@versia/kit/db";
import { type SQL, and, eq, isNull } from "@versia/kit/drizzle";
import { OpenIdAccounts, Users } from "@versia/kit/tables";
import { describeRoute } from "hono-openapi";
import { validator } from "hono-openapi/zod";
import { setCookie } from "hono/cookie";
import { SignJWT } from "jose";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error.ts";
import type { PluginType } from "../../index.ts";
import { automaticOidcFlow } from "../../utils.ts";

export default (plugin: PluginType): void => {
    plugin.registerRoute("/oauth/sso/{issuer}/callback", (app) => {
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
                },
            }),
            plugin.middleware,
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
                    client_id: z.string().optional(),
                    flow: z.string(),
                    link: z
                        .string()
                        .transform((v) =>
                            ["true", "1", "on"].includes(v.toLowerCase()),
                        )
                        .optional(),
                    user_id: z.string().uuid().optional(),
                }),
                handleZodError,
            ),
            async (context) => {
                const currentUrl = new URL(context.req.url);
                const redirectUrl = new URL(context.req.url);

                // Correct some reverse proxies incorrectly setting the protocol as http, even if the original request was https
                // Looking at you, Traefik
                if (
                    new URL(context.get("config").http.base_url).protocol ===
                        "https:" &&
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
                const {
                    flow: flowId,
                    user_id,
                    link,
                } = context.req.valid("query");

                const issuer = context
                    .get("pluginConfig")
                    .providers.find((provider) => provider.id === issuerParam);

                if (!issuer) {
                    throw new ApiError(404, "Issuer not found");
                }

                const userInfo = await automaticOidcFlow(
                    issuer,
                    flowId,
                    currentUrl,
                    redirectUrl,
                    (error, message, flow) => {
                        const errorSearchParams = new URLSearchParams(
                            Object.entries({
                                redirect_uri: flow?.application?.redirectUri,
                                client_id: flow?.application?.clientId,
                                response_type: "code",
                                scope: flow?.application?.scopes,
                            }).filter(([_, value]) => value !== undefined) as [
                                string,
                                string,
                            ][],
                        );

                        errorSearchParams.append("error", error);
                        errorSearchParams.append("error_description", message);

                        return context.redirect(
                            `${context.get("config").frontend.routes.login}?${errorSearchParams.toString()}`,
                        );
                    },
                );

                if (userInfo instanceof Response) {
                    return userInfo;
                }

                const { sub, email, preferred_username, picture } =
                    userInfo.userInfo;
                const flow = userInfo.flow;

                const errorSearchParams = new URLSearchParams(
                    Object.entries({
                        redirect_uri: flow.application?.redirectUri,
                        client_id: flow.application?.clientId,
                        response_type: "code",
                        scope: flow.application?.scopes,
                    }).filter(([_, value]) => value !== undefined) as [
                        string,
                        string,
                    ][],
                );

                // If linking account
                if (link && user_id) {
                    // Check if userId is equal to application.clientId
                    if (!flow.application?.clientId.startsWith(user_id)) {
                        return context.redirect(
                            `${context.get("config").http.base_url}${
                                context.get("config").frontend.routes.home
                            }?${new URLSearchParams({
                                oidc_account_linking_error:
                                    "Account linking error",
                                oidc_account_linking_error_message: `User ID does not match application client ID (${user_id} != ${flow.application?.clientId})`,
                            })}`,
                        );
                    }

                    // Check if account is already linked
                    const account = await db.query.OpenIdAccounts.findFirst({
                        where: (account, { eq, and }): SQL | undefined =>
                            and(
                                eq(account.serverId, sub),
                                eq(account.issuerId, issuer.id),
                            ),
                    });

                    if (account) {
                        return context.redirect(
                            `${context.get("config").http.base_url}${
                                context.get("config").frontend.routes.home
                            }?${new URLSearchParams({
                                oidc_account_linking_error:
                                    "Account already linked",
                                oidc_account_linking_error_message:
                                    "This account has already been linked to this OpenID Connect provider.",
                            })}`,
                        );
                    }

                    // Link the account
                    await db.insert(OpenIdAccounts).values({
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
                        where: (account, { eq, and }): SQL | undefined =>
                            and(
                                eq(account.serverId, sub),
                                eq(account.issuerId, issuer.id),
                            ),
                    })
                )?.userId;

                if (!userId) {
                    // Register new user
                    if (context.get("pluginConfig").allow_registration) {
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
                        const user = await User.fromDataLocal({
                            email: doesEmailExist ? undefined : email,
                            username,
                            avatar: avatar ?? undefined,
                            password: undefined,
                        });

                        // Link account
                        await db.insert(OpenIdAccounts).values({
                            serverId: sub,
                            issuerId: issuer.id,
                            userId: user.id,
                        });

                        userId = user.id;
                    } else {
                        errorSearchParams.append("error", "invalid_request");
                        errorSearchParams.append(
                            "error_description",
                            "No user found with that account",
                        );

                        return context.redirect(
                            `${context.get("config").frontend.routes.login}?${errorSearchParams.toString()}`,
                        );
                    }
                }

                const user = await User.fromId(userId);

                if (!user) {
                    errorSearchParams.append("error", "invalid_request");
                    errorSearchParams.append(
                        "error_description",
                        "No user found with that account",
                    );

                    return context.redirect(
                        `${context.get("config").frontend.routes.login}?${errorSearchParams.toString()}`,
                    );
                }

                if (!user.hasPermission(RolePermission.OAuth)) {
                    errorSearchParams.append("error", "invalid_request");
                    errorSearchParams.append(
                        "error_description",
                        `User does not have the '${RolePermission.OAuth}' permission`,
                    );

                    return context.redirect(
                        `${context.get("config").frontend.routes.login}?${errorSearchParams.toString()}`,
                    );
                }

                if (!flow.application) {
                    throw new ApiError(500, "Application not found");
                }

                const code = randomString(32, "hex");

                await Token.insert({
                    accessToken: randomString(64, "base64url"),
                    code,
                    scope: flow.application.scopes,
                    tokenType: "Bearer",
                    userId: user.id,
                    applicationId: flow.application.id,
                });

                // Generate JWT
                const jwt = await new SignJWT({
                    sub: user.id,
                    iss: new URL(context.get("config").http.base_url).origin,
                    aud: flow.application.clientId,
                    exp: Math.floor(Date.now() / 1000) + 60 * 60,
                    iat: Math.floor(Date.now() / 1000),
                    nbf: Math.floor(Date.now() / 1000),
                })
                    .setProtectedHeader({ alg: "EdDSA" })
                    .sign(context.get("pluginConfig").keys?.private);

                // Redirect back to application
                setCookie(context, "jwt", jwt, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "strict",
                    path: "/",
                    // 2 weeks
                    maxAge: 60 * 60 * 24 * 14,
                });

                return context.redirect(
                    new URL(
                        `${context.get("config").frontend.routes.consent}?${new URLSearchParams(
                            {
                                redirect_uri: flow.application.redirectUri,
                                code,
                                client_id: flow.application.clientId,
                                application: flow.application.name,
                                website: flow.application.website ?? "",
                                scope: flow.application.scopes,
                                response_type: "code",
                            },
                        ).toString()}`,
                        context.get("config").http.base_url,
                    ).toString(),
                );
            },
        );
    });
};
