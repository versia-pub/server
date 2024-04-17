import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { sql } from "drizzle-orm";
import {
    anyOf,
    charIn,
    createRegExp,
    digit,
    exactly,
    global,
    letter,
    maybe,
    oneOrMore,
} from "magic-regexp";
import { z } from "zod";
import {
    type UserWithRelations,
    findManyUsers,
    resolveWebFinger,
    userToAPI,
} from "~database/entities/User";
import { Users } from "~drizzle/schema";

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

export const schema = z.object({
    q: z
        .string()
        .min(1)
        .max(512)
        .regex(
            createRegExp(
                maybe("@"),
                oneOrMore(
                    anyOf(letter.lowercase, digit, charIn("-")),
                ).groupedAs("username"),
                maybe(
                    exactly("@"),
                    oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs(
                        "domain",
                    ),
                ),
                [global],
            ),
        ),
    limit: z.coerce.number().int().min(1).max(80).default(40),
    offset: z.coerce.number().int().optional(),
    resolve: z.coerce.boolean().optional(),
    following: z.coerce.boolean().optional(),
});

export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        // TODO: Add checks for disabled or not email verified accounts
        const {
            following = false,
            limit,
            offset,
            resolve,
            q,
        } = extraData.parsedRequest;

        const { user: self } = extraData.auth;

        if (!self && following) return errorResponse("Unauthorized", 401);

        // Remove any leading @
        const [username, host] = q.replace(/^@/, "").split("@");

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
                                ? sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${Users.id} AND "Relationships"."ownerId" = ${account.id} AND "Relationships"."following" = true)`
                                : undefined,
                        ),
                    offset,
                    limit,
                })),
            );
        }

        return jsonResponse(accounts.map((acct) => userToAPI(acct)));
    },
);
