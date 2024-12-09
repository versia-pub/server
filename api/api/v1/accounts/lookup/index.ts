import { apiRoute, applyConfig, auth, parseUserAddress } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Instance, User } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { config } from "~/packages/config-manager";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/lookup",
    auth: {
        required: false,
        oauthPermissions: [],
    },
    permissions: {
        required: [RolePermissions.Search],
    },
});

export const schemas = {
    query: z.object({
        acct: z.string().min(1).max(512).toLowerCase(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/lookup",
    summary: "Lookup account",
    description: "Lookup an account by acct",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Account",
            content: {
                "application/json": {
                    schema: User.schema,
                },
            },
        },
        404: {
            description: "Not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        422: {
            description: "Invalid parameter",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { acct } = context.req.valid("query");
        const { user } = context.get("auth");

        // Check if acct is matching format username@domain.com or @username@domain.com
        const { username, domain } = parseUserAddress(acct);

        if (!username) {
            throw new Error("Invalid username");
        }

        // User is local
        if (!domain || domain === new URL(config.http.base_url).host) {
            const account = await User.fromSql(
                and(eq(Users.username, username), isNull(Users.instanceId)),
            );

            if (account) {
                return context.json(account.toApi(), 200);
            }

            return context.json(
                { error: `Account with username ${username} not found` },
                404,
            );
        }

        // User is remote
        // Try to fetch it from database
        const instance = await Instance.resolveFromHost(domain);

        if (!instance) {
            return context.json({ error: `Instance ${domain} not found` }, 404);
        }

        const account = await User.fromSql(
            and(
                eq(Users.username, username),
                eq(Users.instanceId, instance.id),
            ),
        );

        if (account) {
            return context.json(account.toApi(), 200);
        }

        // Fetch from remote instance
        const manager = await (user ?? User).getFederationRequester();

        const uri = await User.webFinger(manager, username, domain);

        if (!uri) {
            return context.json({ error: "Account not found" }, 404);
        }

        const foundAccount = await User.resolve(uri);

        if (foundAccount) {
            return context.json(foundAccount.toApi(), 200);
        }

        return context.json({ error: "Account not found" }, 404);
    }),
);
