import { applyConfig, auth, handleZodError } from "@/api";
import { dualLogger } from "@/loggers";
import { MeiliIndexType, meilisearch } from "@/meilisearch";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { resolveWebFinger } from "~/database/entities/User";
import { db } from "~/drizzle/db";
import { Instances, Notes, Users } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { Note } from "~/packages/database-interface/note";
import { User } from "~/packages/database-interface/user";
import { LogLevel } from "~/packages/log-manager";

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
        auth(meta.auth),
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

            if (!config.meilisearch.enabled) {
                return errorResponse("Meilisearch is not enabled", 501);
            }

            let accountResults: { id: string }[] = [];
            let statusResults: { id: string }[] = [];

            if (!type || type === "accounts") {
                // Check if q is matching format username@domain.com or @username@domain.com
                const accountMatches = q
                    ?.trim()
                    .match(/@?[a-zA-Z0-9_]+(@[a-zA-Z0-9_.:]+)/g);
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
                            accounts: [account.toAPI()],
                            statuses: [],
                            hashtags: [],
                        });
                    }

                    if (resolve) {
                        const newUser = await resolveWebFinger(
                            username,
                            domain,
                        ).catch((e) => {
                            dualLogger.logError(
                                LogLevel.ERROR,
                                "WebFinger.Resolve",
                                e,
                            );
                            return null;
                        });

                        if (newUser) {
                            return jsonResponse({
                                accounts: [newUser.toAPI()],
                                statuses: [],
                                hashtags: [],
                            });
                        }
                    }
                }

                accountResults = (
                    await meilisearch.index(MeiliIndexType.Accounts).search<{
                        id: string;
                    }>(q, {
                        limit: Number(limit) || 10,
                        offset: Number(offset) || 0,
                        sort: ["createdAt:desc"],
                    })
                ).hits;
            }

            if (!type || type === "statuses") {
                statusResults = (
                    await meilisearch.index(MeiliIndexType.Statuses).search<{
                        id: string;
                    }>(q, {
                        limit: Number(limit) || 10,
                        offset: Number(offset) || 0,
                        sort: ["createdAt:desc"],
                    })
                ).hits;
            }

            const accounts = await User.manyFromSql(
                and(
                    inArray(
                        Users.id,
                        accountResults.map((hit) => hit.id),
                    ),
                    self
                        ? sql`EXISTS (SELECT 1 FROM Relationships WHERE Relationships.subjectId = ${
                              self?.id
                          } AND Relationships.following = ${!!following} AND Relationships.ownerId = ${
                              Users.id
                          })`
                        : undefined,
                ),
            );

            const statuses = await Note.manyFromSql(
                and(
                    inArray(
                        Notes.id,
                        statusResults.map((hit) => hit.id),
                    ),
                    account_id ? eq(Notes.authorId, account_id) : undefined,
                    self
                        ? sql`EXISTS (SELECT 1 FROM Relationships WHERE Relationships.subjectId = ${
                              self?.id
                          } AND Relationships.following = ${!!following} AND Relationships.ownerId = ${
                              Notes.authorId
                          })`
                        : undefined,
                ),
                undefined,
                undefined,
                undefined,
                self?.id,
            );

            return jsonResponse({
                accounts: accounts.map((account) => account.toAPI()),
                statuses: await Promise.all(
                    statuses.map((status) => status.toAPI(self)),
                ),
                hashtags: [],
            });
        },
    );
