import {
    Account as AccountSchema,
    RolePermission,
    zBoolean,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { User } from "@versia-server/kit/db";
import { parseUserAddress } from "@versia-server/kit/parsers";
import { Users } from "@versia-server/kit/tables";
import { eq, ilike, not, or, sql } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import stringComparison from "string-comparison";
import { z } from "zod";
import { rateLimit } from "../../../../../middlewares/rate-limit.ts";

export default apiRoute((app) =>
    app.get(
        "/api/v1/accounts/search",
        describeRoute({
            summary: "Search for matching accounts",
            description:
                "Search for matching accounts by username or display name.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#search",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description: "Accounts",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(AccountSchema)),
                        },
                    },
                },
            },
        }),
        rateLimit(5),
        auth({
            auth: false,
            permissions: [RolePermission.Search, RolePermission.ViewAccounts],
            scopes: ["read:accounts"],
        }),
        validator(
            "query",
            z.object({
                q: AccountSchema.shape.username
                    .or(AccountSchema.shape.acct)
                    .meta({
                        description: "Search query for accounts.",
                        example: "username",
                    }),
                limit: z.coerce.number().int().min(1).max(80).default(40).meta({
                    description: "Maximum number of results.",
                    example: 40,
                }),
                offset: z.coerce.number().int().default(0).meta({
                    description: "Skip the first n results.",
                    example: 0,
                }),
                resolve: zBoolean.default(false).meta({
                    description:
                        "Attempt WebFinger lookup. Use this when q is an exact address.",
                    example: false,
                }),
                following: zBoolean.default(false).meta({
                    description: "Limit the search to users you are following.",
                    example: false,
                }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { q, limit, offset, resolve, following } =
                context.req.valid("query");
            const { user } = context.get("auth");

            if (!user && following) {
                throw new ApiError(
                    401,
                    "Must be authenticated to use 'following'",
                );
            }

            const { username, domain } = parseUserAddress(q);

            const accounts: User[] = [];

            if (resolve && domain) {
                const uri = await User.webFinger(username, domain);

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
        },
    ),
);
