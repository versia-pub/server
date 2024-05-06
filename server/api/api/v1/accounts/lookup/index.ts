import { applyConfig, auth, handleZodError } from "@api";
import { zValidator } from "@hono/zod-validator";
import { dualLogger } from "@loggers";
import { errorResponse, jsonResponse } from "@response";
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
import { resolveWebFinger } from "~database/entities/User";
import { Users } from "~drizzle/schema";
import { User } from "~packages/database-interface/user";
import { LogLevel } from "~packages/log-manager";

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
        auth(meta.auth),
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
                    dualLogger.logError(
                        LogLevel.ERROR,
                        "WebFinger.Resolve",
                        e as Error,
                    );
                    return null;
                });

                if (foundAccount) {
                    return jsonResponse(foundAccount.toAPI());
                }

                return errorResponse("Account not found", 404);
            }

            let username = acct;
            if (username.startsWith("@")) {
                username = username.slice(1);
            }

            const account = await User.fromSql(eq(Users.username, username));

            if (account) {
                return jsonResponse(account.toAPI());
            }

            return errorResponse(
                `Account with username ${username} not found`,
                404,
            );
        },
    );
