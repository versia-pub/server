import { apiRoute, handleZodError } from "@/api";
import { Application, User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { eq, or } from "drizzle-orm";
import type { Context } from "hono";
import { describeRoute } from "hono-openapi";
import { validator } from "hono-openapi/zod";
import { setCookie } from "hono/cookie";
import { SignJWT } from "jose";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";

const returnError = (
    context: Context,
    error: string,
    description: string,
): Response => {
    const searchParams = new URLSearchParams();

    // Add all data that is not undefined except email and password
    for (const [key, value] of Object.entries(context.req.query())) {
        if (key !== "email" && key !== "password" && value !== undefined) {
            searchParams.append(key, value);
        }
    }

    searchParams.append("error", error);
    searchParams.append("error_description", description);

    return context.redirect(
        new URL(
            `${config.frontend.routes.login}?${searchParams.toString()}`,
            config.http.base_url,
        ).toString(),
    );
};

export default apiRoute((app) =>
    app.post(
        "/api/auth/login",
        describeRoute({
            summary: "Login",
            description: "Login to the application",
            responses: {
                302: {
                    description: "Redirect to OAuth authorize, or error",
                    headers: {
                        "Set-Cookie": {
                            description: "JWT cookie",
                            required: false,
                        },
                    },
                },
            },
        }),
        validator(
            "query",
            z.object({
                scope: z.string().optional(),
                redirect_uri: z.string().url().optional(),
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
                prompt: z
                    .enum(["none", "login", "consent", "select_account"])
                    .optional()
                    .default("none"),
                max_age: z
                    .number()
                    .int()
                    .optional()
                    .default(60 * 60 * 24 * 7),
            }),
            handleZodError,
        ),
        validator(
            "form",
            z.object({
                identifier: z
                    .string()
                    .email()
                    .toLowerCase()
                    .or(z.string().toLowerCase()),
                password: z.string().min(2).max(100),
            }),
            handleZodError,
        ),
        async (context) => {
            const oidcConfig = config.plugins?.config?.["@versia/openid"] as
                | {
                      forced: boolean;
                      providers: {
                          id: string;
                          name: string;
                          icon: string;
                      }[];
                      keys: {
                          private: string;
                          public: string;
                      };
                  }
                | undefined;

            if (!oidcConfig) {
                return returnError(
                    context,
                    "invalid_request",
                    "The OpenID Connect plugin is not enabled on this instance. Cannot process login request.",
                );
            }

            if (oidcConfig?.forced) {
                return returnError(
                    context,
                    "invalid_request",
                    "Logging in with a password is disabled by the administrator. Please use a valid OpenID Connect provider.",
                );
            }

            const { identifier, password } = context.req.valid("form");
            const { client_id } = context.req.valid("query");

            // Find user
            const user = await User.fromSql(
                or(
                    eq(Users.email, identifier.toLowerCase()),
                    eq(Users.username, identifier.toLowerCase()),
                ),
            );

            if (
                !(
                    user &&
                    (await Bun.password.verify(
                        password,
                        user.data.password || "",
                    ))
                )
            ) {
                return returnError(
                    context,
                    "invalid_grant",
                    "Invalid identifier or password",
                );
            }

            if (user.data.passwordResetToken) {
                return context.redirect(
                    `${config.frontend.routes.password_reset}?${new URLSearchParams(
                        {
                            token: user.data.passwordResetToken ?? "",
                            login_reset: "true",
                        },
                    ).toString()}`,
                );
            }

            // Try and import the key
            const privateKey = await crypto.subtle.importKey(
                "pkcs8",
                Buffer.from(oidcConfig?.keys?.private ?? "", "base64"),
                "Ed25519",
                false,
                ["sign"],
            );

            // Generate JWT
            const jwt = await new SignJWT({
                sub: user.id,
                iss: config.http.base_url.origin,
                aud: client_id,
                exp: Math.floor(Date.now() / 1000) + 60 * 60,
                iat: Math.floor(Date.now() / 1000),
                nbf: Math.floor(Date.now() / 1000),
            })
                .setProtectedHeader({ alg: "EdDSA" })
                .sign(privateKey);

            const application = await Application.fromClientId(client_id);

            if (!application) {
                throw new ApiError(400, "Invalid application");
            }

            const searchParams = new URLSearchParams({
                application: application.data.name,
            });

            if (application.data.website) {
                searchParams.append("website", application.data.website);
            }

            // Add all data that is not undefined except email and password
            for (const [key, value] of Object.entries(context.req.query())) {
                if (
                    key !== "email" &&
                    key !== "password" &&
                    value !== undefined
                ) {
                    searchParams.append(key, String(value));
                }
            }

            // Redirect to OAuth authorize with JWT
            setCookie(context, "jwt", jwt, {
                httpOnly: true,
                secure: true,
                sameSite: "Strict",
                path: "/",
                // 2 weeks
                maxAge: 60 * 60 * 24 * 14,
            });
            return context.redirect(
                `${config.frontend.routes.consent}?${searchParams.toString()}`,
            );
        },
    ),
);
