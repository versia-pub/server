import { RolePermission } from "@versia/client/schemas";
import { ApiError, Hooks, Plugin } from "@versia/kit";
import { User } from "@versia/kit/db";
import { keyPair, sensitiveString, url } from "@versia-server/config/schema";
import { getCookie } from "hono/cookie";
import { jwtVerify } from "jose";
import { JOSEError, JWTExpired } from "jose/errors";
import { z } from "zod";
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
                client_secret: sensitiveString,
                icon: url.optional(),
            }),
        )
        .default([]),
    keys: keyPair,
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

plugin.registerRoute("/admin/queues/api/*", (app) => {
    // Check for JWT when accessing the admin panel
    app.use("/admin/queues/api/*", async (context, next) => {
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

        if (!user?.hasPermission(RolePermission.ManageInstanceFederation)) {
            throw new ApiError(
                403,
                `Missing '${RolePermission.ManageInstanceFederation}' permission`,
            );
        }

        await next();
    });
});

export type PluginType = typeof plugin;
export default plugin;
