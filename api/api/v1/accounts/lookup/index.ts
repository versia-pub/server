import {
    accountNotFound,
    apiRoute,
    auth,
    parseUserAddress,
    reusedResponses,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Instance, User } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";
import { Account } from "~/classes/schemas/account";
import { Account as AccountSchema } from "~/classes/schemas/account";
import { config } from "~/packages/config-manager";

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/lookup",
    summary: "Lookup account ID from Webfinger address",
    description:
        "Quickly lookup a username to see if it is available, skipping WebFinger resolution.",
    middleware: [
        auth({
            auth: false,
            permissions: [RolePermissions.Search],
        }),
    ] as const,
    request: {
        query: z.object({
            acct: AccountSchema.shape.acct.openapi({
                description: "The username or Webfinger address to lookup.",
                example: "lexi@beta.versia.social",
            }),
        }),
    },
    responses: {
        200: {
            description: "Account",
            content: {
                "application/json": {
                    schema: Account,
                },
            },
        },
        404: accountNotFound,
        422: reusedResponses[422],
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { acct } = context.req.valid("query");
        const { user } = context.get("auth");

        // Check if acct is matching format username@domain.com or @username@domain.com
        const { username, domain } = parseUserAddress(acct);

        // User is local
        if (!domain || domain === config.http.base_url.host) {
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
            throw new ApiError(404, "Account not found");
        }

        const foundAccount = await User.resolve(uri);

        if (foundAccount) {
            return context.json(foundAccount.toApi(), 200);
        }

        throw new ApiError(404, "Account not found");
    }),
);
