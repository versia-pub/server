import { auth } from "@/api";
import { proxyUrl } from "@/response";
import { createRoute, z } from "@hono/zod-openapi";
import { db } from "@versia/kit/db";
import { eq } from "@versia/kit/drizzle";
import { OpenIdAccounts, RolePermissions } from "@versia/kit/tables";
import type { PluginType } from "~/plugins/openid";
import { ErrorSchema } from "~/types/api";

export default (plugin: PluginType) => {
    plugin.registerRoute("/api/v1/sso", (app) => {
        app.openapi(
            createRoute({
                method: "get",
                path: "/api/v1/sso/{id}",
                summary: "Get linked account",
                middleware: [
                    auth(
                        {
                            required: true,
                        },
                        {
                            required: [RolePermissions.OAuth],
                        },
                    ),
                    plugin.middleware,
                ],
                request: {
                    params: z.object({
                        id: z.string(),
                    }),
                },
                responses: {
                    200: {
                        description: "Linked account",
                        content: {
                            "application/json": {
                                schema: z.object({
                                    id: z.string(),
                                    name: z.string(),
                                    icon: z.string().optional(),
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
                        description: "Account not found",
                        content: {
                            "application/json": {
                                schema: ErrorSchema,
                            },
                        },
                    },
                },
            }),
            async (context) => {
                const { id: issuerId } = context.req.valid("param");
                const { user } = context.get("auth");

                if (!user) {
                    return context.json(
                        {
                            error: "Unauthorized",
                        },
                        401,
                    );
                }

                const issuer = context
                    .get("pluginConfig")
                    .providers.find((provider) => provider.id === issuerId);

                if (!issuer) {
                    return context.json(
                        {
                            error: `Issuer with ID ${issuerId} not found in instance's OpenID configuration`,
                        },
                        404,
                    );
                }

                const account = await db.query.OpenIdAccounts.findFirst({
                    where: (account, { eq, and }) =>
                        and(
                            eq(account.userId, user.id),
                            eq(account.issuerId, issuerId),
                        ),
                });

                if (!account) {
                    return context.json(
                        {
                            error: "Account not found or is not linked to this issuer",
                        },
                        404,
                    );
                }

                return context.json(
                    {
                        id: issuer.id,
                        name: issuer.name,
                        icon: proxyUrl(issuer.icon) ?? undefined,
                    },
                    200,
                );
            },
        );

        app.openapi(
            createRoute({
                method: "delete",
                path: "/api/v1/sso/{id}",
                summary: "Unlink account",
                middleware: [
                    auth(
                        {
                            required: true,
                        },
                        {
                            required: [RolePermissions.OAuth],
                        },
                    ),
                    plugin.middleware,
                ],
                request: {
                    params: z.object({
                        id: z.string(),
                    }),
                },
                responses: {
                    204: {
                        description: "Account unlinked",
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
                        description: "Account not found",
                        content: {
                            "application/json": {
                                schema: ErrorSchema,
                            },
                        },
                    },
                },
            }),
            async (context) => {
                const { id: issuerId } = context.req.valid("param");
                const { user } = context.get("auth");

                if (!user) {
                    return context.json({ error: "Unauthorized" }, 401);
                }

                // Check if issuer exists
                const issuer = context
                    .get("pluginConfig")
                    .providers.find((provider) => provider.id === issuerId);

                if (!issuer) {
                    return context.json(
                        {
                            error: `Issuer with ID ${issuerId} not found in instance's OpenID configuration`,
                        },
                        404,
                    );
                }

                const account = await db.query.OpenIdAccounts.findFirst({
                    where: (account, { eq, and }) =>
                        and(
                            eq(account.userId, user.id),
                            eq(account.issuerId, issuerId),
                        ),
                });

                if (!account) {
                    return context.json(
                        {
                            error: "Account not found or is not linked to this issuer",
                        },
                        404,
                    );
                }

                await db
                    .delete(OpenIdAccounts)
                    .where(eq(OpenIdAccounts.id, account.id));

                return context.newResponse(null, 204);
            },
        );
    });
};
