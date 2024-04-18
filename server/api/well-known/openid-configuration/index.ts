import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";
import { config } from "~packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 30,
        max: 60,
    },
    route: "/.well-known/openid-configuration",
});

export default apiRoute(async (req, matchedRoute, extraData) => {
    const base_url = new URL(config.http.base_url);
    return jsonResponse({
        issuer: base_url.origin.toString(),
        authorization_endpoint: `${base_url.origin}/oauth/authorize`,
        token_endpoint: `${base_url.origin}/oauth/token`,
        userinfo_endpoint: `${base_url.origin}/api/v1/accounts/verify_credentials`,
        jwks_uri: `${base_url.origin}/.well-known/jwks`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["EdDSA"],
        scopes_supported: ["openid", "profile", "email"],
        token_endpoint_auth_methods_supported: ["client_secret_basic"],
        claims_supported: ["sub"],
    });
});
