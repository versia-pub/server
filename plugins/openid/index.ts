import { Hooks, Plugin } from "@versia/kit";
import chalk from "chalk";
import { z } from "zod";
import { User } from "@versia/kit/db";
import authorizeRoute from "./routes/authorize.ts";
import jwksRoute from "./routes/jwks.ts";
import ssoLoginCallbackRoute from "./routes/oauth/callback.ts";
import tokenRevokeRoute from "./routes/oauth/revoke.ts";
import ssoLoginRoute from "./routes/oauth/sso.ts";
import tokenRoute from "./routes/oauth/token.ts";
import ssoIdRoute from "./routes/sso/:id/index.ts";
import ssoRoute from "./routes/sso/index.ts";

const plugin = new Plugin(
    z.object({
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
                    const { public_key, private_key } =
                        await User.generateKeys();

                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Keys are missing, please add the following to your config:\n\nkeys.public: ${chalk.gray(public_key)}\nkeys.private: ${chalk.gray(private_key)}
                        `,
                    });
                }

                return v as Exclude<typeof v, undefined>;
            }),
    }),
);

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

export type PluginType = typeof plugin;
export default plugin;
