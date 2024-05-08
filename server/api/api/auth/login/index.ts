import { applyConfig, handleZodError } from "@api";
import { zValidator } from "@hono/zod-validator";
import { errorResponse, response } from "@response";
import { eq, or } from "drizzle-orm";
import type { Hono } from "hono";
import { SignJWT } from "jose";
import { z } from "zod";
import { db } from "~drizzle/db";
import { Users } from "~drizzle/schema";
import { config } from "~packages/config-manager";
import { User } from "~packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 4,
        duration: 60,
    },
    route: "/api/auth/login",
    auth: {
        required: false,
    },
});

export const schemas = {
    form: z.object({
        identifier: z
            .string()
            .email()
            .toLowerCase()
            .or(z.string().toLowerCase()),
        password: z.string().min(2).max(100),
    }),
    query: z.object({
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
        Location: new URL(
            `/oauth/authorize?${searchParams.toString()}`,
            config.http.base_url,
        ).toString(),
    });
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("form", schemas.form, handleZodError),
        zValidator("query", schemas.query, handleZodError),
        async (context) => {
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
                !user ||
                !(await Bun.password.verify(
                    password,
                    user.getUser().password || "",
                ))
            )
                return returnError(
                    context.req.query(),
                    "invalid_grant",
                    "Invalid email or password",
                );

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
                aud: client_id,
                exp: Math.floor(Date.now() / 1000) + 60 * 60,
                iat: Math.floor(Date.now() / 1000),
                nbf: Math.floor(Date.now() / 1000),
            })
                .setProtectedHeader({ alg: "EdDSA" })
                .sign(privateKey);

            const application = await db.query.Applications.findFirst({
                where: (app, { eq }) => eq(app.clientId, client_id),
            });

            if (!application) {
                return errorResponse("Invalid application", 400);
            }

            const searchParams = new URLSearchParams({
                application: application.name,
                client_secret: application.secret,
            });

            if (application.website)
                searchParams.append("website", application.website);

            // Add all data that is not undefined except email and password
            for (const [key, value] of Object.entries(context.req.query())) {
                if (
                    key !== "email" &&
                    key !== "password" &&
                    value !== undefined
                )
                    searchParams.append(key, String(value));
            }

            // Redirect to OAuth authorize with JWT
            return response(null, 302, {
                Location: new URL(
                    `/oauth/consent?${searchParams.toString()}`,
                    config.http.base_url,
                ).toString(),
                // Set cookie with JWT
                "Set-Cookie": `jwt=${jwt}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${
                    60 * 60
                }`,
            });
        },
    );
