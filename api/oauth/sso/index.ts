import { apiRoute, applyConfig } from "@/api";
import { oauthRedirectUri } from "@/constants";
import { createRoute } from "@hono/zod-openapi";
import type { Context } from "hono";
import {
    calculatePKCECodeChallenge,
    discoveryRequest,
    generateRandomCodeVerifier,
    processDiscoveryResponse,
} from "oauth4webapi";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { OpenIdLoginFlows } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/oauth/sso",
});

export const schemas = {
    query: z.object({
        issuer: z.string(),
        client_id: z.string().optional(),
        redirect_uri: z.string().url().optional(),
        scope: z.string().optional(),
        response_type: z.enum(["code"]).optional(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/oauth/sso",
    summary: "Initiate SSO login flow",
    request: {
        query: schemas.query,
    },
    responses: {
        302: {
            description:
                "Redirect to SSO login, or redirect to login page with error",
        },
    },
});

const returnError = (
    context: Context,
    query: object,
    error: string,
    description: string,
) => {
    const searchParams = new URLSearchParams();

    // Add all data that is not undefined except email and password
    for (const [key, value] of Object.entries(query)) {
        if (key !== "email" && key !== "password" && value !== undefined) {
            searchParams.append(key, value);
        }
    }

    searchParams.append("error", error);
    searchParams.append("error_description", description);

    return context.redirect(
        `${config.frontend.routes.login}?${searchParams.toString()}`,
    );
};

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        // This is the Versia client's client_id, not the external OAuth provider's client_id
        const { issuer: issuerId, client_id } = context.req.valid("query");
        const body = await context.req.query();

        if (!client_id || client_id === "undefined") {
            return returnError(
                context,
                body,
                "invalid_request",
                "client_id is required",
            );
        }

        const issuer = config.oidc.providers.find(
            (provider) => provider.id === issuerId,
        );

        if (!issuer) {
            return returnError(
                context,
                body,
                "invalid_request",
                "issuer is invalid",
            );
        }

        const issuerUrl = new URL(issuer.url);

        const authServer = await discoveryRequest(issuerUrl, {
            algorithm: "oidc",
        }).then((res) => processDiscoveryResponse(issuerUrl, res));

        const codeVerifier = generateRandomCodeVerifier();

        const application = await db.query.Applications.findFirst({
            where: (application, { eq }) => eq(application.clientId, client_id),
        });

        if (!application) {
            return returnError(
                context,
                body,
                "invalid_request",
                "client_id is invalid",
            );
        }

        // Store into database
        const newFlow = (
            await db
                .insert(OpenIdLoginFlows)
                .values({
                    codeVerifier,
                    applicationId: application.id,
                    issuerId,
                })
                .returning()
        )[0];

        const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

        return context.redirect(
            `${authServer.authorization_endpoint}?${new URLSearchParams({
                client_id: issuer.client_id,
                redirect_uri: `${oauthRedirectUri(issuerId)}?flow=${
                    newFlow.id
                }`,
                response_type: "code",
                scope: "openid profile email",
                // PKCE
                code_challenge_method: "S256",
                code_challenge: codeChallenge,
            }).toString()}`,
        );
    }),
);
