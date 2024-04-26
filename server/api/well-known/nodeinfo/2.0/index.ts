import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";
import manifest from "~package.json";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/.well-known/nodeinfo/2.0",
});

/**
 * ActivityPub nodeinfo 2.0 endpoint
 */
export default apiRoute(() => {
    // TODO: Implement this
    return jsonResponse({
        version: "2.0",
        software: { name: "lysand", version: manifest.version },
        protocols: ["lysand"],
        services: { outbound: [], inbound: [] },
        usage: {
            users: { total: 0, activeMonth: 0, activeHalfyear: 0 },
            localPosts: 0,
        },
        openRegistrations: false,
        metadata: {},
    });
});
