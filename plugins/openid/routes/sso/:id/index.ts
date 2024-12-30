import { auth } from "@/api";
import { proxyUrl } from "@/response";
import { createRoute, z } from "@hono/zod-openapi";
import { db } from "@versia/kit/db";
import { type SQL, eq } from "@versia/kit/drizzle";
import { OpenIdAccounts, RolePermissions } from "@versia/kit/tables";
import { ApiError } from "~/classes/errors/api-error";
import type { PluginType } from "~/plugins/openid";
import { ErrorSchema } from "~/types/api";

export default (plugin: PluginType): void => {
    plugin.registerRoute("/api/v1/sso", (app) => {
        app.openapi(
            createRoute({
                method: "get",
                path: "/api/v1/sso/{id}",
                summary: "Get linked account",
                middleware: [
                    auth({
                        auth: true,
                        permissions: [RolePermissions.OAuth],
                    }),
                    plugin.middleware,
                ] as const,
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
                    throw new ApiError(401, "Unauthorized");
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
                    where: (account, { eq, and }): SQL | undefined =>
                        and(
                            eq(account.userId, user.id),
                            eq(account.issuerId, issuerId),
                        ),
                });

                if (!account) {
                    throw new ApiError(
                        404,
                        "Account not found or is not linked to this issuer",
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
                    auth({
                        auth: true,
                        permissions: [RolePermissions.OAuth],
                    }),
                    plugin.middleware,
                ] as const,
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
                    throw new ApiError(401, "Unauthorized");
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
                    where: (account, { eq, and }): SQL | undefined =>
                        and(
                            eq(account.userId, user.id),
                            eq(account.issuerId, issuerId),
                        ),
                });

                if (!account) {
                    throw new ApiError(
                        404,
                        "Account not found or is not linked to this issuer",
                    );
                }

                await db
                    .delete(OpenIdAccounts)
                    .where(eq(OpenIdAccounts.id, account.id));

                return context.body(null, 204);
            },
        );
    });
};
