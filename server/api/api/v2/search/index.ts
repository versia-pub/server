import { apiRoute, applyConfig } from "@api";
import { dualLogger } from "@loggers";
import { MeiliIndexType, meilisearch } from "@meilisearch";
import { errorResponse, jsonResponse } from "@response";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { findManyStatuses, statusToAPI } from "~database/entities/Status";
import {
    findFirstUser,
    findManyUsers,
    resolveWebFinger,
    userToAPI,
} from "~database/entities/User";
import { db } from "~drizzle/db";
import { instance, user } from "~drizzle/schema";
import { LogLevel } from "~packages/log-manager";

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

export const schema = z.object({
    q: z.string().optional(),
    type: z.string().optional(),
    resolve: z.coerce.boolean().optional(),
    following: z.coerce.boolean().optional(),
    account_id: z.string().optional(),
    max_id: z.string().optional(),
    min_id: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(40).optional(),
    offset: z.coerce.number().int().optional(),
});

export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { user: self } = extraData.auth;

        const {
            q,
            type,
            resolve,
            following,
            account_id,
            // max_id,
            // min_id,
            limit = 20,
            offset,
        } = extraData.parsedRequest;

        const config = await extraData.configManager.getConfig();

        if (!config.meilisearch.enabled) {
            return errorResponse("Meilisearch is not enabled", 501);
        }

        if (!self && (resolve || offset)) {
            return errorResponse(
                "Cannot use resolve or offset without being authenticated",
                401,
            );
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
                            id: user.id,
                        })
                        .from(user)
                        .leftJoin(instance, eq(user.instanceId, instance.id))
                        .where(
                            and(
                                eq(user.username, username),
                                eq(instance.baseUrl, domain),
                            ),
                        )
                )[0]?.id;

                const account = accountId
                    ? await findFirstUser({
                          where: (user, { eq }) => eq(user.id, accountId),
                      })
                    : null;

                if (account) {
                    return jsonResponse({
                        accounts: [userToAPI(account)],
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
                            accounts: [userToAPI(newUser)],
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

        const accounts = await findManyUsers({
            where: (user, { and, eq, inArray }) =>
                and(
                    inArray(
                        user.id,
                        accountResults.map((hit) => hit.id),
                    ),
                    self
                        ? sql`EXISTS (SELECT 1 FROM Relationships WHERE Relationships.subjectId = ${
                              self?.id
                          } AND Relationships.following = ${
                              following ? true : false
                          } AND Relationships.objectId = ${user.id})`
                        : undefined,
                ),
            orderBy: (user, { desc }) => desc(user.createdAt),
        });

        const statuses = await findManyStatuses({
            where: (status, { and, eq, inArray }) =>
                and(
                    inArray(
                        status.id,
                        statusResults.map((hit) => hit.id),
                    ),
                    account_id ? eq(status.authorId, account_id) : undefined,
                    self
                        ? sql`EXISTS (SELECT 1 FROM Relationships WHERE Relationships.subjectId = ${
                              self?.id
                          } AND Relationships.following = ${
                              following ? true : false
                          } AND Relationships.objectId = ${status.authorId})`
                        : undefined,
                ),
            orderBy: (status, { desc }) => desc(status.createdAt),
        });

        return jsonResponse({
            accounts: accounts.map((account) => userToAPI(account)),
            statuses: await Promise.all(
                statuses.map((status) => statusToAPI(status)),
            ),
            hashtags: [],
        });
    },
);
