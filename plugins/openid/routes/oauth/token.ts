import { jsonOrForm } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { db } from "~/drizzle/db";
import { Tokens } from "~/drizzle/schema";
import type { PluginType } from "../..";

export const schemas = {
    json: z.object({
        code: z.string().optional(),
        code_verifier: z.string().optional(),
        grant_type: z
            .enum([
                "authorization_code",
                "refresh_token",
                "client_credentials",
                "password",
                "urn:ietf:params:oauth:grant-type:device_code",
                "urn:ietf:params:oauth:grant-type:token-exchange",
                "urn:ietf:params:oauth:grant-type:saml2-bearer",
                "urn:openid:params:grant-type:ciba",
            ])
            .default("authorization_code"),
        client_id: z.string().optional(),
        client_secret: z.string().optional(),
        username: z.string().trim().optional(),
        password: z.string().trim().optional(),
        redirect_uri: z.string().url().optional(),
        refresh_token: z.string().optional(),
        scope: z.string().optional(),
        assertion: z.string().optional(),
        audience: z.string().optional(),
        subject_token_type: z.string().optional(),
        subject_token: z.string().optional(),
        actor_token_type: z.string().optional(),
        actor_token: z.string().optional(),
        auth_req_id: z.string().optional(),
    }),
};

export default (plugin: PluginType) => {
    plugin.registerRoute("/oauth/token", (app) => {
        app.openapi(
            createRoute({
                method: "post",
                path: "/oauth/token",
                summary: "Get token",
                middleware: [jsonOrForm()],
                request: {
                    body: {
                        content: {
                            "application/json": {
                                schema: schemas.json,
                            },
                            "application/x-www-form-urlencoded": {
                                schema: schemas.json,
                            },
                            "multipart/form-data": {
                                schema: schemas.json,
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: "Token",
                        content: {
                            "application/json": {
                                schema: z.object({
                                    access_token: z.string(),
                                    token_type: z.string(),
                                    expires_in: z
                                        .number()
                                        .optional()
                                        .nullable(),
                                    id_token: z.string().optional().nullable(),
                                    refresh_token: z
                                        .string()
                                        .optional()
                                        .nullable(),
                                    scope: z.string().optional(),
                                    created_at: z.number(),
                                }),
                            },
                        },
                    },
                    401: {
                        description: "Authorization error",
                        content: {
                            "application/json": {
                                schema: z.object({
                                    error: z.string(),
                                    error_description: z.string(),
                                }),
                            },
                        },
                    },
                },
            }),
            async (context) => {
                const {
                    grant_type,
                    code,
                    redirect_uri,
                    client_id,
                    client_secret,
                } = context.req.valid("json");

                switch (grant_type) {
                    case "authorization_code": {
                        if (!code) {
                            return context.json(
                                {
                                    error: "invalid_request",
                                    error_description: "Code is required",
                                },
                                401,
                            );
                        }

                        if (!redirect_uri) {
                            return context.json(
                                {
                                    error: "invalid_request",
                                    error_description:
                                        "Redirect URI is required",
                                },
                                401,
                            );
                        }

                        if (!client_id) {
                            return context.json(
                                {
                                    error: "invalid_request",
                                    error_description: "Client ID is required",
                                },
                                401,
                            );
                        }

                        // Verify the client_secret
                        const client = await db.query.Applications.findFirst({
                            where: (application, { eq }) =>
                                eq(application.clientId, client_id),
                        });

                        if (!client || client.secret !== client_secret) {
                            return context.json(
                                {
                                    error: "invalid_client",
                                    error_description:
                                        "Invalid client credentials",
                                },
                                401,
                            );
                        }

                        const token = await db.query.Tokens.findFirst({
                            where: (token, { eq, and }) =>
                                and(
                                    eq(token.code, code),
                                    eq(
                                        token.redirectUri,
                                        decodeURI(redirect_uri),
                                    ),
                                    eq(token.clientId, client_id),
                                ),
                        });

                        if (!token) {
                            return context.json(
                                {
                                    error: "invalid_grant",
                                    error_description: "Code not found",
                                },
                                401,
                            );
                        }

                        // Invalidate the code
                        await db
                            .update(Tokens)
                            .set({ code: null })
                            .where(eq(Tokens.id, token.id));

                        return context.json(
                            {
                                access_token: token.accessToken,
                                token_type: "Bearer",
                                expires_in: token.expiresAt
                                    ? Math.floor(
                                          (new Date(token.expiresAt).getTime() -
                                              Date.now()) /
                                              1000,
                                      )
                                    : null,
                                id_token: token.idToken,
                                refresh_token: null,
                                scope: token.scope,
                                created_at: Math.floor(
                                    new Date(token.createdAt).getTime() / 1000,
                                ),
                            },
                            200,
                        );
                    }
                }

                return context.json(
                    {
                        error: "unsupported_grant_type",
                        error_description: "Unsupported grant type",
                    },
                    401,
                );
            },
        );
    });
};
