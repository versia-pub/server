import { z } from "@hono/zod-openapi";
import { Hooks, Plugin } from "@versia/kit";
import { User } from "@versia/kit/db";
import chalk from "chalk";
import { getCookie } from "hono/cookie";
import { jwtVerify } from "jose";
import { JOSEError, JWTExpired } from "jose/errors";
import { ApiError } from "~/classes/errors/api-error.ts";
import { RolePermissions } from "~/drizzle/schema.ts";
import authorizeRoute from "./routes/authorize.ts";
import jwksRoute from "./routes/jwks.ts";
import ssoLoginCallbackRoute from "./routes/oauth/callback.ts";
import tokenRevokeRoute from "./routes/oauth/revoke.ts";
import ssoLoginRoute from "./routes/oauth/sso.ts";
import tokenRoute from "./routes/oauth/token.ts";
import ssoIdRoute from "./routes/sso/:id/index.ts";
import ssoRoute from "./routes/sso/index.ts";

const configSchema = z.object({
    forced: z.boolean().default(false),
    allow_registration: z.boolean().default(true),
    providers: z
        .array(
            z.object({
                name: z.string().min(1),
                id: z.string().min(1),
                url: z.string().min(1),
                client_id: z.string().min(1),
                client_secret: z.string().min(1),
                icon: z.string().min(1).optional(),
            }),
        )
        .default([]),
    keys: z
        .object({
            public: z
                .string()
                .min(1)
                .transform(async (v) => {
                    try {
                        return await crypto.subtle.importKey(
                            "spki",
                            Buffer.from(v, "base64"),
                            "Ed25519",
                            true,
                            ["verify"],
                        );
                    } catch {
                        throw new Error(
                            "Public key at oidc.keys.public is invalid",
                        );
                    }
                }),
            private: z
                .string()
                .min(1)
                .transform(async (v) => {
                    try {
                        return await crypto.subtle.importKey(
                            "pkcs8",
                            Buffer.from(v, "base64"),
                            "Ed25519",
                            true,
                            ["sign"],
                        );
                    } catch {
                        throw new Error(
                            "Private key at oidc.keys.private is invalid",
                        );
                    }
                }),
        })
        .optional()
        .transform(async (v, ctx) => {
            if (!(v?.private && v?.public)) {
                const { public_key, private_key } = await User.generateKeys();

                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Keys are missing, please add the following to your config:\n\nkeys.public: ${chalk.gray(public_key)}\nkeys.private: ${chalk.gray(private_key)}
                    `,
                });
            }

            return v as Exclude<typeof v, undefined>;
        }),
});

const plugin = new Plugin(configSchema);

// Test hook for screenshots
plugin.registerHandler(Hooks.Response, (req) => {
    console.info("Request received:", req);
    return req;
});

authorizeRoute(plugin);
ssoRoute(plugin);
ssoIdRoute(plugin);
tokenRoute(plugin);
tokenRevokeRoute(plugin);
jwksRoute(plugin);
ssoLoginRoute(plugin);
ssoLoginCallbackRoute(plugin);

plugin.registerRoute("/admin/*", (app) => {
    // Check for JWT when accessing the admin panel
    app.use("/admin/*", async (context, next) => {
        const jwtCookie = getCookie(context, "jwt");

        if (!jwtCookie) {
            throw new ApiError(401, "Missing JWT cookie");
        }

        const { keys } = context.get("pluginConfig");

        const result = await jwtVerify(jwtCookie, keys.public, {
            algorithms: ["EdDSA"],
            issuer: new URL(context.get("config").http.base_url).origin,
        }).catch((error) => {
            if (error instanceof JOSEError) {
                return error;
            }

            throw error;
        });

        if (result instanceof JOSEError) {
            if (result instanceof JWTExpired) {
                throw new ApiError(401, "JWT has expired");
            }

            throw new ApiError(401, "Invalid JWT");
        }

        const {
            payload: { sub },
        } = result;

        if (!sub) {
            throw new ApiError(401, "Invalid JWT (no sub)");
        }

        const user = await User.fromId(sub);

        if (!user?.hasPermission(RolePermissions.ManageInstanceFederation)) {
            throw new ApiError(
                403,
                `Missing '${RolePermissions.ManageInstanceFederation}' permission`,
            );
        }

        await next();
    });
});

export type PluginType = typeof plugin;
export default plugin;
