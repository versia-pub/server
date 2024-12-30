import { auth, jsonOrForm } from "@/api";
import { randomString } from "@/math";
import { Application, Token, User } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { type JWTPayload, SignJWT, jwtVerify } from "jose";
import { JOSEError } from "jose/errors";
import { z } from "zod";
import { errorRedirect, errors } from "../errors.ts";
import type { PluginType } from "../index.ts";

const schemas = {
    query: z.object({
        prompt: z
            .enum(["none", "login", "consent", "select_account"])
            .optional()
            .default("none"),
        max_age: z.coerce
            .number()
            .int()
            .optional()
            .default(60 * 60 * 24 * 7),
    }),
    json: z
        .object({
            scope: z.string().optional(),
            redirect_uri: z
                .string()
                .url()
                .optional()
                .or(z.literal("urn:ietf:wg:oauth:2.0:oob")),
            response_type: z.enum([
                "code",
                "token",
                "none",
                "id_token",
                "code id_token",
                "code token",
                "token id_token",
                "code token id_token",
            ]),
            client_id: z.string(),
            state: z.string().optional(),
            code_challenge: z.string().optional(),
            code_challenge_method: z.enum(["plain", "S256"]).optional(),
        })
        .refine(
            // Check if redirect_uri is valid for code flow
            (data) =>
                data.response_type.includes("code") ? data.redirect_uri : true,
            "redirect_uri is required for code flow",
        ),
    // Disable for Mastodon API compatibility
    /* .refine(
            // Check if code_challenge is valid for code flow
            (data) =>
                data.response_type.includes("code")
                    ? data.code_challenge
                    : true,
            "code_challenge is required for code flow",
        ), */
    cookies: z.object({
        jwt: z.string(),
    }),
};

export default (plugin: PluginType): void =>
    plugin.registerRoute("/oauth/authorize", (app) =>
        app.openapi(
            {
                method: "post",
                path: "/oauth/authorize",
                middleware: [
                    auth({
                        required: false,
                    }),
                    jsonOrForm(),
                    plugin.middleware,
                ],
                responses: {
                    302: {
                        description: "Redirect to the application",
                    },
                },
                request: {
                    query: schemas.query,
                    body: {
                        content: {
                            "application/json": {
                                schema: schemas.json,
                            },
                            "application/x-www-form-urlencoded": {
                                schema: schemas.json,
                            },
                            "multipart/form-data": {
                                schema: schemas.json,
                            },
                        },
                    },
                    cookies: schemas.cookies,
                },
            },
            async (context) => {
                const { scope, redirect_uri, client_id, state } =
                    context.req.valid("json");

                const { jwt } = context.req.valid("cookie");

                const { keys } = context.get("pluginConfig");

                const errorSearchParams = new URLSearchParams(
                    context.req.valid("json"),
                );

                const result = await jwtVerify(jwt, keys.public, {
                    algorithms: ["EdDSA"],
                    audience: client_id,
                    issuer: new URL(context.get("config").http.base_url).origin,
                }).catch((error) => {
                    if (error instanceof JOSEError) {
                        return null;
                    }

                    throw error;
                });

                if (!result) {
                    return errorRedirect(
                        context,
                        errors.InvalidJWT,
                        errorSearchParams,
                    );
                }

                const {
                    payload: { aud, sub, exp },
                } = result;

                if (!(aud && sub && exp)) {
                    return errorRedirect(
                        context,
                        errors.MissingJWTFields,
                        errorSearchParams,
                    );
                }

                if (!z.string().uuid().safeParse(sub).success) {
                    return errorRedirect(
                        context,
                        errors.InvalidSub,
                        errorSearchParams,
                    );
                }

                const user = await User.fromId(sub);

                if (!user) {
                    return errorRedirect(
                        context,
                        errors.UserNotFound,
                        errorSearchParams,
                    );
                }

                if (!user.hasPermission(RolePermissions.OAuth)) {
                    return errorRedirect(
                        context,
                        errors.MissingOauthPermission,
                        errorSearchParams,
                    );
                }

                const application = await Application.fromClientId(client_id);

                if (!application) {
                    return errorRedirect(
                        context,
                        errors.MissingApplication,
                        errorSearchParams,
                    );
                }

                if (application.data.redirectUri !== redirect_uri) {
                    return errorRedirect(
                        context,
                        errors.InvalidRedirectUri,
                        errorSearchParams,
                    );
                }

                // Check that scopes are a subset of the application's scopes
                if (
                    scope &&
                    !scope
                        .split(" ")
                        .every((s) => application.data.scopes.includes(s))
                ) {
                    return errorRedirect(
                        context,
                        errors.InvalidScope,
                        errorSearchParams,
                    );
                }

                const code = randomString(256, "base64url");

                let payload: JWTPayload = {};

                if (scope) {
                    if (scope.split(" ").includes("openid")) {
                        payload = {
                            ...payload,
                            sub: user.id,
                            iss: new URL(context.get("config").http.base_url)
                                .origin,
                            aud: client_id,
                            exp: Math.floor(Date.now() / 1000) + 60 * 60,
                            iat: Math.floor(Date.now() / 1000),
                            nbf: Math.floor(Date.now() / 1000),
                        };
                    }
                    if (scope.split(" ").includes("profile")) {
                        payload = {
                            ...payload,
                            name: user.data.displayName,
                            preferred_username: user.data.username,
                            picture: user.getAvatarUrl(context.get("config")),
                            updated_at: new Date(
                                user.data.updatedAt,
                            ).toISOString(),
                        };
                    }
                    if (scope.split(" ").includes("email")) {
                        payload = {
                            ...payload,
                            email: user.data.email,
                            // TODO: Add verification system
                            email_verified: true,
                        };
                    }
                }

                const idToken = await new SignJWT(payload)
                    .setProtectedHeader({ alg: "EdDSA" })
                    .sign(keys.private);

                await Token.insert({
                    accessToken: randomString(64, "base64url"),
                    code,
                    scope: scope ?? application.data.scopes,
                    tokenType: "Bearer",
                    applicationId: application.id,
                    redirectUri: redirect_uri ?? application.data.redirectUri,
                    expiresAt: new Date(
                        Date.now() + 60 * 60 * 24 * 14,
                    ).toISOString(),
                    idToken: ["profile", "email", "openid"].some((s) =>
                        scope?.split(" ").includes(s),
                    )
                        ? idToken
                        : null,
                    clientId: client_id,
                    userId: user.id,
                });

                const redirectUri =
                    redirect_uri === "urn:ietf:wg:oauth:2.0:oob"
                        ? new URL(
                              "/oauth/code",
                              context.get("config").http.base_url,
                          )
                        : new URL(redirect_uri ?? application.data.redirectUri);

                redirectUri.searchParams.append("code", code);
                state && redirectUri.searchParams.append("state", state);

                return context.redirect(redirectUri.toString());
            },
        ),
    );
