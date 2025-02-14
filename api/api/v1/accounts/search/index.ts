import { apiRoute, auth, parseUserAddress } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { eq, ilike, not, or, sql } from "drizzle-orm";
import stringComparison from "string-comparison";
import { ApiError } from "~/classes/errors/api-error";
import { Account as AccountSchema } from "~/classes/schemas/account";
import { zBoolean } from "~/packages/config-manager/config.type";

export const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/search",
    summary: "Search for matching accounts",
    description: "Search for matching accounts by username or display name.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#search",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: false,
            permissions: [RolePermissions.Search, RolePermissions.ViewAccounts],
            scopes: ["read:accounts"],
        }),
    ] as const,
    request: {
        query: z.object({
            q: AccountSchema.shape.username
                .or(AccountSchema.shape.acct)
                .openapi({
                    description: "Search query for accounts.",
                    example: "username",
                }),
            limit: z.coerce.number().int().min(1).max(80).default(40).openapi({
                description: "Maximum number of results.",
                example: 40,
            }),
            offset: z.coerce.number().int().default(0).openapi({
                description: "Skip the first n results.",
                example: 0,
            }),
            resolve: zBoolean.default(false).openapi({
                description:
                    "Attempt WebFinger lookup. Use this when q is an exact address.",
                example: false,
            }),
            following: zBoolean.default(false).openapi({
                description: "Limit the search to users you are following.",
                example: false,
            }),
        }),
    },
    responses: {
        200: {
            description: "Accounts",
            content: {
                "application/json": {
                    schema: z.array(AccountSchema),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { q, limit, offset, resolve, following } =
            context.req.valid("query");
        const { user } = context.get("auth");

        if (!user && following) {
            throw new ApiError(401, "Must be authenticated to use 'following'");
        }

        const { username, domain } = parseUserAddress(q);

        const accounts: User[] = [];

        if (resolve && domain) {
            const manager = await (user ?? User).getFederationRequester();

            const uri = await User.webFinger(manager, username, domain);

            if (uri) {
                const resolvedUser = await User.resolve(uri);

                if (resolvedUser) {
                    accounts.push(resolvedUser);
                }
            }
        } else {
            accounts.push(
                ...(await User.manyFromSql(
                    or(
                        ilike(Users.displayName, `%${q}%`),
                        ilike(Users.username, `%${q}%`),
                        following && user
                            ? sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${Users.id} AND "Relationships"."ownerId" = ${user.id} AND "Relationships"."following" = true)`
                            : undefined,
                        user ? not(eq(Users.id, user.id)) : undefined,
                    ),
                    undefined,
                    limit,
                    offset,
                )),
            );
        }

        const indexOfCorrectSort = stringComparison.jaccardIndex
            .sortMatch(
                q,
                accounts.map((acct) => acct.getAcct()),
            )
            .map((sort) => sort.index);

        const result = indexOfCorrectSort.map((index) => accounts[index]);

        return context.json(
            result.map((acct) => acct.toApi()),
            200,
        );
    }),
);
