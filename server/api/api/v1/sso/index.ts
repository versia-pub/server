import { applyConfig, auth, handleZodError, jsonOrForm } from "@/api";
import { oauthRedirectUri } from "@/constants";
import { randomString } from "@/math";
import { errorResponse, jsonResponse, proxyUrl } from "@/response";
import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
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
    form: z
        .object({
            issuer: z.string(),
        })
        .partial(),
};

/**
 * SSO Account Linking management endpoint
 * A GET request allows the user to list all their linked accounts
 * A POST request allows the user to link a new account, and returns a link
 */
export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        jsonOrForm(),
        zValidator("form", schemas.form, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const form = context.req.valid("form");
            const { user } = context.req.valid("header");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            switch (context.req.method) {
                case "GET": {
                    // Get all linked accounts
                    const accounts = await db.query.OpenIdAccounts.findMany({
                        where: (User, { eq }) => eq(User.userId, user.id),
                    });

                    return jsonResponse(
                        accounts
                            .map((account) => {
                                const issuer = config.oidc.providers.find(
                                    (provider) =>
                                        provider.id === account.issuerId,
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
                    );
                }
                case "POST": {
                    if (!form) {
                        return errorResponse(
                            "Missing issuer in form body",
                            400,
                        );
                    }

                    const { issuer: issuerId } = form;

                    if (!issuerId) {
                        return errorResponse(
                            "Missing issuer in form body",
                            400,
                        );
                    }

                    const issuer = config.oidc.providers.find(
                        (provider) => provider.id === issuerId,
                    );

                    if (!issuer) {
                        return errorResponse(
                            `Issuer ${issuerId} not found`,
                            404,
                        );
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
                                name: "Lysand",
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

                    const codeChallenge =
                        await calculatePKCECodeChallenge(codeVerifier);

                    return jsonResponse({
                        link: `${
                            authServer.authorization_endpoint
                        }?${new URLSearchParams({
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
                        }).toString()}`,
                    });
                }
            }
        },
    );
