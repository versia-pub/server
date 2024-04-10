import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import type { UserWithRelations } from "~database/entities/User";
import { resolveWebFinger, userToAPI } from "~database/entities/User";
import { userRelations } from "~database/entities/relations";

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

export default apiRoute<{
    acct: string;
}>(async (req, matchedRoute, extraData) => {
    const { acct } = extraData.parsedRequest;

    if (!acct) {
        return errorResponse("Invalid acct parameter", 400);
    }

    // Check if acct is matching format username@domain.com or @username@domain.com
    const accountMatches = acct
        ?.trim()
        .match(/@?[a-zA-Z0-9_]+(@[a-zA-Z0-9_.:]+)/g);
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

    const account = await client.user.findFirst({
        where: {
            username,
        },
        include: userRelations,
    });

    if (account) {
        return jsonResponse(userToAPI(account));
    }

    return errorResponse(`Account with username ${username} not found"`, 404);
});
