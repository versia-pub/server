import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { config } from "~/packages/config-manager";

const route = createRoute({
    method: "get",
    path: "/.well-known/openid-configuration",
    summary: "OpenID Configuration",
    responses: {
        200: {
            description: "OpenID Configuration",
            content: {
                "application/json": {
                    schema: z.object({
                        issuer: z.string(),
                        authorization_endpoint: z.string(),
                        token_endpoint: z.string(),
                        userinfo_endpoint: z.string(),
                        jwks_uri: z.string(),
                        response_types_supported: z.array(z.string()),
                        subject_types_supported: z.array(z.string()),
                        id_token_signing_alg_values_supported: z.array(
                            z.string(),
                        ),
                        scopes_supported: z.array(z.string()),
                        token_endpoint_auth_methods_supported: z.array(
                            z.string(),
                        ),
                        claims_supported: z.array(z.string()),
                    }),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, (context) => {
        const baseUrl = config.http.base_url;
        return context.json(
            {
                issuer: baseUrl.origin.toString(),
                authorization_endpoint: `${baseUrl.origin}/oauth/authorize`,
                token_endpoint: `${baseUrl.origin}/oauth/token`,
                userinfo_endpoint: `${baseUrl.origin}/api/v1/accounts/verify_credentials`,
                jwks_uri: `${baseUrl.origin}/.well-known/jwks`,
                response_types_supported: ["code"],
                subject_types_supported: ["public"],
                id_token_signing_alg_values_supported: ["EdDSA"],
                scopes_supported: ["openid", "profile", "email"],
                token_endpoint_auth_methods_supported: ["client_secret_basic"],
                claims_supported: ["sub"],
            },
            200,
        );
    }),
);
