import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { SignatureConstructor } from "@lysand-org/federation";
import { FederationRequester } from "@lysand-org/federation/requester";
import { eq } from "drizzle-orm";
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
            const { user } = context.req.valid("header");

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

                const requester = user ?? User.getServerActor();

                const signatureConstructor =
                    await SignatureConstructor.fromStringKey(
                        requester.data.privateKey ?? "",
                        requester.getUri(),
                    );
                const manager = new FederationRequester(
                    new URL(`https://${domain}`),
                    signatureConstructor,
                );

                const uri = await manager.webFinger(username);

                const foundAccount = await User.resolve(uri);

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
