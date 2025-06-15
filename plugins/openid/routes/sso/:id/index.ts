import { RolePermission } from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { db } from "@versia/kit/db";
import { OpenIdAccounts } from "@versia/kit/tables";
import { and, eq, type SQL } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { auth, handleZodError } from "@/api";
import type { PluginType } from "~/plugins/openid";

export default (plugin: PluginType): void => {
    plugin.registerRoute("/api/v1/sso/:id", (app) => {
        app.get(
            "/api/v1/sso/:id",
            describeRoute({
                summary: "Get linked account",
                tags: ["SSO"],
                responses: {
                    200: {
                        description: "Linked account",
                        content: {
                            "application/json": {
                                schema: resolver(
                                    z.object({
                                        id: z.string(),
                                        name: z.string(),
                                        icon: z.string().optional(),
                                    }),
                                ),
                            },
                        },
                    },
                    404: ApiError.accountNotFound().schema,
                },
            }),
            auth({
                auth: true,
                permissions: [RolePermission.OAuth],
            }),
            plugin.middleware,
            validator("param", z.object({ id: z.string() }), handleZodError),
            async (context) => {
                const { id: issuerId } = context.req.valid("param");
                const { user } = context.get("auth");

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
                    where: (account): SQL | undefined =>
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
                        icon: issuer.icon?.proxied,
                    },
                    200,
                );
            },
        );

        app.delete(
            "/api/v1/sso/:id",
            describeRoute({
                summary: "Unlink account",
                tags: ["SSO"],
                responses: {
                    204: {
                        description: "Account unlinked",
                    },
                    404: {
                        description: "Account not found",
                        content: {
                            "application/json": {
                                schema: resolver(ApiError.zodSchema),
                            },
                        },
                    },
                },
            }),
            auth({
                auth: true,
                permissions: [RolePermission.OAuth],
            }),
            plugin.middleware,
            validator("param", z.object({ id: z.string() }), handleZodError),
            async (context) => {
                const { id: issuerId } = context.req.valid("param");
                const { user } = context.get("auth");

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
                    where: (account): SQL | undefined =>
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
