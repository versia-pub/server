import { apiRoute, applyConfig, auth, jsonOrForm } from "@/api";
import { oauthRedirectUri } from "@/constants";
import { randomString } from "@/math";
import { proxyUrl } from "@/response";
import { createRoute } from "@hono/zod-openapi";
import {
    calculatePKCECodeChallenge,
    discoveryRequest,
    generateRandomCodeVerifier,
    processDiscoveryResponse,
} from "oauth4webapi";
import { z } from "zod";
import { db } from "~/drizzle/db";
import {
    Applications,
    OpenIdLoginFlows,
    RolePermissions,
} from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    allowedMethods: ["GET", "POST"],
    auth: {
        required: true,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/api/v1/sso",
    permissions: {
        required: [RolePermissions.OAuth],
    },
});

export const schemas = {
    json: z.object({
        issuer: z.string(),
    }),
};

const routeGet = createRoute({
    method: "get",
    path: "/api/v1/sso",
    summary: "Get linked accounts",
    middleware: [auth(meta.auth)],
    responses: {
        200: {
            description: "Linked accounts",
            content: {
                "application/json": {
                    schema: z.array(
                        z.object({
                            id: z.string(),
                            name: z.string(),
                            icon: z.string().optional(),
                        }),
                    ),
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

const routePost = createRoute({
    method: "post",
    path: "/api/v1/sso",
    summary: "Link account",
    middleware: [auth(meta.auth), jsonOrForm()],
    request: {
        body: {
            content: {
                "application/json": {
                    schema: schemas.json,
                },
                "multipart/form-data": {
                    schema: schemas.json,
                },
                "application/x-www-form-urlencoded": {
                    schema: schemas.json,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Link URL",
            content: {
                "application/json": {
                    schema: z.object({
                        link: z.string(),
                    }),
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        404: {
            description: "Issuer not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) => {
    app.openapi(routeGet, async (context) => {
        // const form = context.req.valid("json");
        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        // Get all linked accounts
        const accounts = await db.query.OpenIdAccounts.findMany({
            where: (User, { eq }) => eq(User.userId, user.id),
        });

        return context.json(
            accounts
                .map((account) => {
                    const issuer = config.oidc.providers.find(
                        (provider) => provider.id === account.issuerId,
                    );

                    if (!issuer) {
                        return null;
                    }

                    return {
                        id: issuer.id,
                        name: issuer.name,
                        icon: proxyUrl(issuer.icon) || undefined,
                    };
                })
                .filter(Boolean) as {
                id: string;
                name: string;
                icon: string | undefined;
            }[],
            200,
        );
    });

    app.openapi(routePost, async (context) => {
        const { issuer: issuerId } = context.req.valid("json");
        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const issuer = config.oidc.providers.find(
            (provider) => provider.id === issuerId,
        );

        if (!issuer) {
            return context.json({ error: `Issuer ${issuerId} not found` }, 404);
        }

        const issuerUrl = new URL(issuer.url);

        const authServer = await discoveryRequest(issuerUrl, {
            algorithm: "oidc",
        }).then((res) => processDiscoveryResponse(issuerUrl, res));

        const codeVerifier = generateRandomCodeVerifier();

        const application = (
            await db
                .insert(Applications)
                .values({
                    clientId: user.id + randomString(32, "base64"),
                    name: "Versia",
                    redirectUri: `${oauthRedirectUri(issuerId)}`,
                    scopes: "openid profile email",
                    secret: "",
                })
                .returning()
        )[0];

        // Store into database
        const newFlow = (
            await db
                .insert(OpenIdLoginFlows)
                .values({
                    codeVerifier,
                    issuerId,
                    applicationId: application.id,
                })
                .returning()
        )[0];

        const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

        return context.json(
            {
                link: `${authServer.authorization_endpoint}?${new URLSearchParams(
                    {
                        client_id: issuer.client_id,
                        redirect_uri: `${oauthRedirectUri(
                            issuerId,
                        )}?${new URLSearchParams({
                            flow: newFlow.id,
                            link: "true",
                            user_id: user.id,
                        })}`,
                        response_type: "code",
                        scope: "openid profile email",
                        // PKCE
                        code_challenge_method: "S256",
                        code_challenge: codeChallenge,
                    },
                ).toString()}`,
            },
            200,
        );
    });
});
