import { applyConfig, auth, handleZodError, userAddressValidator } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { getLogger } from "@logtape/logtape";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { resolveWebFinger } from "~/classes/functions/user";
import { searchManager } from "~/classes/search/search-manager";
import { db } from "~/drizzle/db";
import { Instances, Notes, RolePermissions, Users } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { Note } from "~/packages/database-interface/note";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 10,
        duration: 60,
    },
    route: "/api/v2/search",
    auth: {
        required: false,
        oauthPermissions: ["read:search"],
    },
    permissions: {
        required: [
            RolePermissions.Search,
            RolePermissions.ViewAccounts,
            RolePermissions.ViewNotes,
        ],
    },
});

export const schemas = {
    query: z.object({
        q: z.string().trim().optional(),
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

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user: self } = context.req.valid("header");
            const { q, type, resolve, following, account_id, limit, offset } =
                context.req.valid("query");

            if (!self && (resolve || offset)) {
                return errorResponse(
                    "Cannot use resolve or offset without being authenticated",
                    401,
                );
            }

            if (!q) {
                return errorResponse("Query is required", 400);
            }

            if (!config.sonic.enabled) {
                return errorResponse(
                    "Search is not enabled by your server administrator",
                    501,
                );
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

                    const [username, domain] = accountMatches[0].split("@");

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
                                    eq(Instances.baseUrl, domain),
                                ),
                            )
                    )[0]?.id;

                    const account = accountId
                        ? await User.fromId(accountId)
                        : null;

                    if (account) {
                        return jsonResponse({
                            accounts: [account.toApi()],
                            statuses: [],
                            hashtags: [],
                        });
                    }

                    if (resolve) {
                        const newUser = await resolveWebFinger(
                            username,
                            domain,
                        ).catch((e) => {
                            getLogger("webfinger").error`${e}`;
                            return null;
                        });

                        if (newUser) {
                            return jsonResponse({
                                accounts: [newUser.toApi()],
                                statuses: [],
                                hashtags: [],
                            });
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
                              self && following
                                  ? sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${
                                        self?.id
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
                              self && following
                                  ? sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${
                                        self?.id
                                    } AND "Relationships".following = ${!!following} AND "Relationships"."ownerId" = ${
                                        Notes.authorId
                                    })`
                                  : undefined,
                          ),
                          undefined,
                          undefined,
                          undefined,
                          self?.id,
                      )
                    : [];

            return jsonResponse({
                accounts: accounts.map((account) => account.toApi()),
                statuses: await Promise.all(
                    statuses.map((status) => status.toApi(self)),
                ),
                hashtags: [],
            });
        },
    );
