import {
    Account as AccountSchema,
    Id,
    RolePermission,
    Search as SearchSchema,
    userAddressRegex,
    zBoolean,
} from "@versia/client/schemas";
import { config } from "@versia-server/config";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { db, Note, User } from "@versia-server/kit/db";
import { parseUserAddress } from "@versia-server/kit/parsers";
import { searchManager } from "@versia-server/kit/search";
import { Instances, Notes, Users } from "@versia-server/kit/tables";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.get(
        "/api/v2/search",
        describeRoute({
            summary: "Perform a search",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/search/#v2",
            },
            tags: ["Search"],
            responses: {
                200: {
                    description: "Search results",
                    content: {
                        "application/json": {
                            schema: resolver(SearchSchema),
                        },
                    },
                },
                401: {
                    description:
                        "Cannot use resolve or offset without being authenticated",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
                501: {
                    description: "Search is not enabled on this server",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
                422: ApiError.validationFailed().schema,
            },
        }),
        validator(
            "query",
            z.object({
                q: z.string().trim().meta({
                    description: "The search query.",
                    example: "versia",
                }),
                type: z
                    .enum(["accounts", "hashtags", "statuses"])
                    .optional()
                    .meta({
                        description:
                            "Specify whether to search for only accounts, hashtags, statuses",
                        example: "accounts",
                    }),
                resolve: zBoolean.default(false).meta({
                    description:
                        "Only relevant if type includes accounts. If true and (a) the search query is for a remote account (e.g., someaccount@someother.server) and (b) the local server does not know about the account, WebFinger is used to try and resolve the account at someother.server. This provides the best recall at higher latency. If false only accounts the server knows about are returned.",
                }),
                following: zBoolean.default(false).meta({
                    description:
                        "Only include accounts that the user is following?",
                }),
                account_id: AccountSchema.shape.id.optional().meta({
                    description:
                        " If provided, will only return statuses authored by this account.",
                }),
                exclude_unreviewed: zBoolean.default(false).meta({
                    description:
                        "Filter out unreviewed tags? Use true when trying to find trending tags.",
                }),
                max_id: Id.optional().meta({
                    description:
                        "All results returned will be lesser than this ID. In effect, sets an upper bound on results.",
                    example: "8d35243d-b959-43e2-8bac-1a9d4eaea2aa",
                }),
                since_id: Id.optional().meta({
                    description:
                        "All results returned will be greater than this ID. In effect, sets a lower bound on results.",
                    example: undefined,
                }),
                min_id: Id.optional().meta({
                    description:
                        "Returns results immediately newer than this ID. In effect, sets a cursor at this ID and paginates forward.",
                    example: undefined,
                }),
                limit: z.coerce.number().int().min(1).max(40).default(20).meta({
                    description: "Maximum number of results to return.",
                }),
                offset: z.coerce.number().int().min(0).default(0).meta({
                    description: "Skip the first n results.",
                }),
            }),
            handleZodError,
        ),
        auth({
            auth: false,
            scopes: ["read:search"],
            permissions: [
                RolePermission.Search,
                RolePermission.ViewAccounts,
                RolePermission.ViewNotes,
            ],
        }),
        async (context) => {
            const { user } = context.get("auth");
            const { q, type, resolve, following, account_id, limit, offset } =
                context.req.valid("query");

            if (!user && (resolve || offset)) {
                throw new ApiError(
                    401,
                    "Usage of 'resolve' or 'offset' requires authentication",
                );
            }

            if (!config.search.enabled) {
                throw new ApiError(501, "Search is not enabled on this server");
            }

            let accountResults: string[] = [];
            let statusResults: string[] = [];

            if (!type || type === "accounts") {
                // Check if q is matching format username@domain.com or @username@domain.com
                const accountMatches = q?.trim().match(userAddressRegex);
                if (accountMatches) {
                    // Remove leading @ if it exists
                    if (accountMatches[0].startsWith("@")) {
                        accountMatches[0] = accountMatches[0].slice(1);
                    }

                    const { username, domain } = parseUserAddress(
                        accountMatches[0],
                    );

                    const accountId = (
                        await db
                            .select({
                                id: Users.id,
                            })
                            .from(Users)
                            .leftJoin(
                                Instances,
                                eq(Users.instanceId, Instances.id),
                            )
                            .where(
                                and(
                                    eq(Users.username, username),
                                    domain
                                        ? eq(Instances.baseUrl, domain)
                                        : isNull(Users.instanceId),
                                ),
                            )
                    )[0]?.id;

                    const account = accountId
                        ? await User.fromId(accountId)
                        : null;

                    if (account) {
                        return context.json(
                            {
                                accounts: [account.toApi()],
                                statuses: [],
                                hashtags: [],
                            },
                            200,
                        );
                    }

                    if (resolve && domain) {
                        const uri = await User.webFinger(username, domain);

                        if (uri) {
                            const newUser = await User.resolve(uri);

                            if (newUser) {
                                return context.json(
                                    {
                                        accounts: [newUser.toApi()],
                                        statuses: [],
                                        hashtags: [],
                                    },
                                    200,
                                );
                            }
                        }
                    }
                }

                accountResults = await searchManager.searchAccounts(
                    q,
                    limit,
                    offset,
                );
            }

            if (!type || type === "statuses") {
                statusResults = await searchManager.searchStatuses(
                    q,
                    limit,
                    offset,
                );
            }

            const accounts =
                accountResults.length > 0
                    ? await User.manyFromSql(
                          and(
                              inArray(
                                  Users.id,
                                  accountResults.map((hit) => hit),
                              ),
                              user && following
                                  ? sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${
                                        user?.id
                                    } AND "Relationships".following = ${!!following} AND "Relationships"."ownerId" = ${
                                        Users.id
                                    })`
                                  : undefined,
                          ),
                      )
                    : [];

            const statuses =
                statusResults.length > 0
                    ? await Note.manyFromSql(
                          and(
                              inArray(
                                  Notes.id,
                                  statusResults.map((hit) => hit),
                              ),
                              account_id
                                  ? eq(Notes.authorId, account_id)
                                  : undefined,
                              user && following
                                  ? sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${
                                        user?.id
                                    } AND "Relationships".following = ${!!following} AND "Relationships"."ownerId" = ${
                                        Notes.authorId
                                    })`
                                  : undefined,
                          ),
                          undefined,
                          undefined,
                          undefined,
                          user?.id,
                      )
                    : [];

            return context.json(
                {
                    accounts: accounts.map((account) => account.toApi()),
                    statuses: await Promise.all(
                        statuses.map((status) => status.toApi(user)),
                    ),
                    hashtags: [],
                },
                200,
            );
        },
    ),
);
