import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { eq, like, not, or, sql } from "drizzle-orm";
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
import { resolveWebFinger } from "~database/entities/User";
import { Users } from "~drizzle/schema";
import { User } from "~packages/database-interface/user";
import stringComparison from "string-comparison";

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

        const accounts: User[] = [];

        if (resolve && username && host) {
            const resolvedUser = await resolveWebFinger(username, host);

            if (resolvedUser) {
                accounts.push(resolvedUser);
            }
        } else {
            accounts.push(
                ...(await User.manyFromSql(
                    or(
                        like(Users.displayName, `%${q}%`),
                        like(Users.username, `%${q}%`),
                        following && self
                            ? sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${Users.id} AND "Relationships"."ownerId" = ${self.id} AND "Relationships"."following" = true)`
                            : undefined,
                        self ? not(eq(Users.id, self.id)) : undefined,
                    ),
                    undefined,
                    limit,
                    offset,
                )),
            );
        }

        // Sort accounts by closest match
        // Returns array of numbers (indexes of accounts array)
        const indexOfCorrectSort = stringComparison.jaccardIndex
            .sortMatch(
                q,
                accounts.map((acct) => acct.getAcct()),
            )
            .map((sort) => sort.index);

        const result = indexOfCorrectSort.map((index) => accounts[index]);

        return jsonResponse(result.map((acct) => acct.toAPI()));
    },
);
