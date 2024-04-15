import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/instance/rules",
    ratelimits: {
        max: 300,
        duration: 60,
    },
    auth: {
        required: false,
    },
});

export default apiRoute(async (req, matchedRoute, extraData) => {
    const config = await extraData.configManager.getConfig();

    return jsonResponse(
        config.signups.rules.map((rule, index) => ({
            id: String(index),
            text: rule,
        })),
    );
});
