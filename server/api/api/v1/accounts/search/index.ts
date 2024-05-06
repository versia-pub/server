import { applyConfig, auth, handleZodError } from "@api";
import { zValidator } from "@hono/zod-validator";
import { errorResponse, jsonResponse } from "@response";
import { eq, like, not, or, sql } from "drizzle-orm";
import type { Hono } from "hono";
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
import stringComparison from "string-comparison";
import { z } from "zod";
import { resolveWebFinger } from "~database/entities/User";
import { Users } from "~drizzle/schema";
import { User } from "~packages/database-interface/user";

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

export const schemas = {
    query: z.object({
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
                        oneOrMore(
                            anyOf(letter, digit, charIn("_-.:")),
                        ).groupedAs("domain"),
                    ),
                    [global],
                ),
            ),
        limit: z.coerce.number().int().min(1).max(80).default(40),
        offset: z.coerce.number().int().optional(),
        resolve: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
        following: z
            .string()
            .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
            .optional(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth),
        async (context) => {
            const { q, limit, offset, resolve, following } =
                context.req.valid("query");
            const { user: self } = context.req.valid("header");

            if (!self && following) return errorResponse("Unauthorized", 401);

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
