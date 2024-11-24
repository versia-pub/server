import { apiRoute, applyConfig, auth, userAddressValidatorRemote } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { eq } from "drizzle-orm";
import { z } from "zod";
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
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { acct } = context.req.valid("query");
        const { user } = context.get("auth");

        // Check if acct is matching format username@domain.com or @username@domain.com
        const accountMatches = acct?.trim().match(userAddressValidatorRemote);

        if (accountMatches) {
            // Remove leading @ if it exists
            if (accountMatches[0].startsWith("@")) {
                accountMatches[0] = accountMatches[0].slice(1);
            }

            const [username, domain] = accountMatches[0].split("@");

            const manager = await (user ?? User).getFederationRequester();

            const uri = await User.webFinger(manager, username, domain);

            const foundAccount = await User.resolve(uri);

            if (foundAccount) {
                return context.json(foundAccount.toApi(), 200);
            }

            return context.json({ error: "Account not found" }, 404);
        }

        let username = acct;
        if (username.startsWith("@")) {
            username = username.slice(1);
        }

        const account = await User.fromSql(eq(Users.username, username));

        if (account) {
            return context.json(account.toApi(), 200);
        }

        return context.json(
            { error: `Account with username ${username} not found` },
            404,
        );
    }),
);
