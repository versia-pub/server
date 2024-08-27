import { apiRoute, applyConfig, auth, handleZodError } from "@/api";
import { zValidator } from "@hono/zod-validator";
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

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { acct } = context.req.valid("query");
            const { user } = context.get("auth");

            if (!acct) {
                return context.json({ error: "Invalid acct parameter" }, 400);
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

                const manager = await (user ?? User).getFederationRequester();

                const uri = await User.webFinger(manager, username, domain);

                const foundAccount = await User.resolve(uri);

                if (foundAccount) {
                    return context.json(foundAccount.toApi());
                }

                return context.json({ error: "Account not found" }, 404);
            }

            let username = acct;
            if (username.startsWith("@")) {
                username = username.slice(1);
            }

            const account = await User.fromSql(eq(Users.username, username));

            if (account) {
                return context.json(account.toApi());
            }

            return context.json(
                { error: `Account with username ${username} not found` },
                404,
            );
        },
    ),
);
