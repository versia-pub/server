import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 60,
    },
    route: "/.well-known/webfinger",
});

export default apiRoute(async (req, matchedRoute, extraData) => {
    // In the format acct:name@example.com
    const resource = matchedRoute.query.resource;
    const requestedUser = resource.split("acct:")[1];

    const config = await extraData.configManager.getConfig();
    const host = new URL(config.http.base_url).hostname;

    // Check if user is a local user
    if (requestedUser.split("@")[1] !== host) {
        return errorResponse("User is a remote user", 404);
    }

    const user = await client.user.findUnique({
        where: { username: requestedUser.split("@")[0] },
    });

    if (!user) {
        return errorResponse("User not found", 404);
    }

    return jsonResponse({
        subject: `acct:${user.username}@${host}`,

        links: [
            {
                rel: "self",
                type: "application/activity+json",
                href: `${config.http.base_url}/users/${user.username}/actor`,
            },
            {
                rel: "https://webfinger.net/rel/profile-page",
                type: "text/html",
                href: `${config.http.base_url}/users/${user.username}`,
            },
            {
                rel: "self",
                type: 'application/activity+json; profile="https://www.w3.org/ns/activitystreams"',
                href: `${config.http.base_url}/users/${user.username}/actor`,
            },
        ],
    });
});
