import {
    Account as AccountSchema,
    RolePermission,
} from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { Instance, User } from "@versia-server/kit/db";
import { parseUserAddress } from "@versia-server/kit/parsers";
import { Users } from "@versia-server/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";
import { rateLimit } from "../../../../../middlewares/rate-limit.ts";

export default apiRoute((app) =>
    app.get(
        "/api/v1/accounts/lookup",
        describeRoute({
            summary: "Lookup account ID from Webfinger address",
            description:
                "Quickly lookup a username to see if it is available, skipping WebFinger resolution.",
            tags: ["Accounts"],
            responses: {
                200: {
                    description: "Account",
                    content: {
                        "application/json": {
                            schema: resolver(AccountSchema),
                        },
                    },
                },
                404: ApiError.accountNotFound().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: false,
            permissions: [RolePermission.Search],
        }),
        rateLimit(60),
        validator(
            "query",
            z.object({
                acct: AccountSchema.shape.acct.meta({
                    description: "The username or Webfinger address to lookup.",
                    example: "lexi@beta.versia.social",
                }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { acct } = context.req.valid("query");

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
                return context.json(
                    { error: `Instance ${domain} not found` },
                    404,
                );
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
            const uri = await User.webFinger(username, domain);

            if (!uri) {
                throw ApiError.accountNotFound();
            }

            const foundAccount = await User.resolve(uri);

            if (foundAccount) {
                return context.json(foundAccount.toApi(), 200);
            }

            throw ApiError.accountNotFound();
        },
    ),
);
