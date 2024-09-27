import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { eq, ilike, not, or, sql } from "drizzle-orm";
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
import { RolePermissions, Users } from "~/drizzle/schema";
import { User } from "~/packages/database-interface/user";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    route: "/api/v1/accounts/search",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: false,
        oauthPermissions: ["read:accounts"],
    },
    permissions: {
        required: [RolePermissions.Search, RolePermissions.ViewAccounts],
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

export const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/search",
    summary: "Search accounts",
    description: "Search for accounts",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Accounts",
            content: {
                "application/json": {
                    schema: z.array(User.schema),
                },
            },
        },
        401: {
            description: "Unauthorized",
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
        const { q, limit, offset, resolve, following } =
            context.req.valid("query");
        const { user: self } = context.get("auth");

        if (!self && following) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const [username, host] = q.replace(/^@/, "").split("@");

        const accounts: User[] = [];

        if (resolve && username && host) {
            const manager = await (self ?? User).getFederationRequester();

            const uri = await User.webFinger(manager, username, host);

            const resolvedUser = await User.resolve(uri);

            if (resolvedUser) {
                accounts.push(resolvedUser);
            }
        } else {
            accounts.push(
                ...(await User.manyFromSql(
                    or(
                        ilike(Users.displayName, `%${q}%`),
                        ilike(Users.username, `%${q}%`),
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

        return context.json(
            result.map((acct) => acct.toApi()),
            200,
        );
    }),
);
