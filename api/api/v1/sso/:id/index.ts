import { apiRoute, applyConfig, auth } from "@/api";
import { proxyUrl } from "@/response";
import { createRoute } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { OpenIdAccounts, RolePermissions } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    allowedMethods: ["GET", "DELETE"],
    auth: {
        required: true,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/api/v1/sso/:id",
    permissions: {
        required: [RolePermissions.OAuth],
    },
});

export const schemas = {
    param: z.object({
        id: z.string(),
    }),
};

const routeGet = createRoute({
    method: "get",
    path: "/api/v1/sso/{id}",
    summary: "Get linked account",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
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
});

const routeDelete = createRoute({
    method: "delete",
    path: "/api/v1/sso/{id}",
    summary: "Unlink account",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
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
});

export default apiRoute((app) => {
    app.openapi(routeGet, async (context) => {
        const { id: issuerId } = context.req.valid("param");
        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        // Check if issuer exists
        const issuer = config.oidc.providers.find(
            (provider) => provider.id === issuerId,
        );

        if (!issuer) {
            return context.json({ error: "Issuer not found" }, 404);
        }

        // Get all linked accounts
        const account = await db.query.OpenIdAccounts.findFirst({
            where: (account, { eq, and }) =>
                and(
                    eq(account.userId, account.id),
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
                icon: proxyUrl(issuer.icon) || undefined,
            },
            200,
        );
    });

    app.openapi(routeDelete, async (context) => {
        const { id: issuerId } = context.req.valid("param");
        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        // Check if issuer exists
        const issuer = config.oidc.providers.find(
            (provider) => provider.id === issuerId,
        );

        if (!issuer) {
            return context.json({ error: "Issuer not found" }, 404);
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
    });
});
