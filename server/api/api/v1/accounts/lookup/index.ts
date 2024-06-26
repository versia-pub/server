import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { getLogger } from "@logtape/logtape";
import { eq } from "drizzle-orm";
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
import { z } from "zod";
import { resolveWebFinger } from "~/database/entities/user";
import { RolePermissions, Users } from "~/drizzle/schema";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/lookup",
    auth: {
        required: false,
        oauthPermissions: [],
    },
    permissions: {
        required: [RolePermissions.Search],
    },
});

export const schemas = {
    query: z.object({
        acct: z.string().min(1).max(512),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { acct } = context.req.valid("query");

            if (!acct) {
                return errorResponse("Invalid acct parameter", 400);
            }

            // Check if acct is matching format username@domain.com or @username@domain.com
            const accountMatches = acct?.trim().match(
                createRegExp(
                    maybe("@"),
                    oneOrMore(
                        anyOf(letter.lowercase, digit, charIn("-")),
                    ).groupedAs("username"),
                    exactly("@"),
                    oneOrMore(anyOf(letter, digit, charIn("_-.:"))).groupedAs(
                        "domain",
                    ),

                    [global],
                ),
            );

            if (accountMatches) {
                // Remove leading @ if it exists
                if (accountMatches[0].startsWith("@")) {
                    accountMatches[0] = accountMatches[0].slice(1);
                }

                const [username, domain] = accountMatches[0].split("@");
                const foundAccount = await resolveWebFinger(
                    username,
                    domain,
                ).catch((e) => {
                    getLogger("webfinger").error`${e}`;
                    return null;
                });

                if (foundAccount) {
                    return jsonResponse(foundAccount.toApi());
                }

                return errorResponse("Account not found", 404);
            }

            let username = acct;
            if (username.startsWith("@")) {
                username = username.slice(1);
            }

            const account = await User.fromSql(eq(Users.username, username));

            if (account) {
                return jsonResponse(account.toApi());
            }

            return errorResponse(
                `Account with username ${username} not found`,
                404,
            );
        },
    );
