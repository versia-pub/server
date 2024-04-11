import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { sql } from "drizzle-orm";
import {
    findManyUsers,
    resolveWebFinger,
    userToAPI,
    type UserWithRelations,
} from "~database/entities/User";
import { user } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/accounts/search",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: false,
        oauthPermissions: ["read:accounts"],
    },
});

export default apiRoute<{
    q?: string;
    limit?: number;
    offset?: number;
    resolve?: boolean;
    following?: boolean;
}>(async (req, matchedRoute, extraData) => {
    // TODO: Add checks for disabled or not email verified accounts
    const {
        following = false,
        limit = 40,
        offset,
        resolve,
        q,
    } = extraData.parsedRequest;

    const { user: self } = extraData.auth;

    if (!self && following) return errorResponse("Unauthorized", 401);

    if (limit < 1 || limit > 80) {
        return errorResponse("Limit must be between 1 and 80", 400);
    }

    if (!q) {
        return errorResponse("Query is required", 400);
    }

    const [username, host] = q?.split("@") || [];

    const accounts: UserWithRelations[] = [];

    if (resolve && username && host) {
        const resolvedUser = await resolveWebFinger(username, host);

        if (resolvedUser) {
            accounts.push(resolvedUser);
        }
    } else {
        accounts.push(
            ...(await findManyUsers({
                where: (account, { or, like }) =>
                    or(
                        like(account.displayName, `%${q}%`),
                        like(account.username, `%${q}%`),
                        following
                            ? sql`EXISTS (SELECT 1 FROM "Relationship" WHERE "Relationship"."subjectId" = ${user.id} AND "Relationship"."ownerId" = ${account.id} AND "Relationship"."following" = true)`
                            : undefined,
                    ),
                offset: Number(offset),
            })),
        );
    }

    return jsonResponse(accounts.map((acct) => userToAPI(acct)));
});
