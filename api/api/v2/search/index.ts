import { apiRoute, auth, parseUserAddress, userAddressValidator } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Note, User, db } from "@versia/kit/db";
import { Instances, Notes, RolePermissions, Users } from "@versia/kit/tables";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { searchManager } from "~/classes/search/search-manager";
import { config } from "~/packages/config-manager";
import { ErrorSchema } from "~/types/api";

const schemas = {
    query: z.object({
        q: z.string().trim(),
        type: z.string().optional(),
        resolve: z.coerce.boolean().optional(),
        following: z.coerce.boolean().optional(),
        account_id: z.string().optional(),
        max_id: z.string().optional(),
        min_id: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(40).optional(),
        offset: z.coerce.number().int().optional(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v2/search",
    summary: "Instance database search",
    middleware: [
        auth({
            auth: false,
            scopes: ["read:search"],
            permissions: [
                RolePermissions.Search,
                RolePermissions.ViewAccounts,
                RolePermissions.ViewNotes,
            ],
        }),
    ] as const,
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Search results",
            content: {
                "application/json": {
                    schema: z.object({
                        accounts: z.array(User.schema),
                        statuses: z.array(Note.schema),
                        hashtags: z.array(z.string()),
                    }),
                },
            },
        },
        401: {
            description:
                "Cannot use resolve or offset without being authenticated",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        501: {
            description: "Search is not enabled on this server",
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
        const { user } = context.get("auth");
        const { q, type, resolve, following, account_id, limit, offset } =
            context.req.valid("query");

        if (!user && (resolve || offset)) {
            throw new ApiError(
                401,
                "Usage of 'resolve' or 'offset' requires authentication",
            );
        }

        if (!config.sonic.enabled) {
            throw new ApiError(501, "Search is not enabled on this server");
        }

        let accountResults: string[] = [];
        let statusResults: string[] = [];

        if (!type || type === "accounts") {
            // Check if q is matching format username@domain.com or @username@domain.com
            const accountMatches = q?.trim().match(userAddressValidator);
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
                        .leftJoin(Instances, eq(Users.instanceId, Instances.id))
                        .where(
                            and(
                                eq(Users.username, username),
                                domain
                                    ? eq(Instances.baseUrl, domain)
                                    : isNull(Users.instanceId),
                            ),
                        )
                )[0]?.id;

                const account = accountId ? await User.fromId(accountId) : null;

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
                    const manager = await (
                        user ?? User
                    ).getFederationRequester();

                    const uri = await User.webFinger(manager, username, domain);

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
                Number(limit) || 10,
                Number(offset) || 0,
            );
        }

        if (!type || type === "statuses") {
            statusResults = await searchManager.searchStatuses(
                q,
                Number(limit) || 10,
                Number(offset) || 0,
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
    }),
);
