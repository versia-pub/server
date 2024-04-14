import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import {
    anyOf,
    charIn,
    createRegExp,
    digit,
    exactly,
    letter,
    maybe,
    oneOrMore,
    global,
} from "magic-regexp";
import { z } from "zod";
import {
    findFirstUser,
    resolveWebFinger,
    userToAPI,
} from "~database/entities/User";

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

export const schema = z.object({
    acct: z.string().min(1).max(512),
});

export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { acct } = extraData.parsedRequest;

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
            const foundAccount = await resolveWebFinger(username, domain).catch(
                (e) => {
                    console.error(e);
                    return null;
                },
            );

            if (foundAccount) {
                return jsonResponse(userToAPI(foundAccount));
            }

            return errorResponse("Account not found", 404);
        }

        let username = acct;
        if (username.startsWith("@")) {
            username = username.slice(1);
        }

        const account = await findFirstUser({
            where: (user, { eq }) => eq(user.username, username),
        });

        if (account) {
            return jsonResponse(userToAPI(account));
        }

        return errorResponse(
            `Account with username ${username} not found`,
            404,
        );
    },
);
