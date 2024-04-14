import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 60,
        duration: 120,
    },
    route: "/api/_fe/config",
    auth: {
        required: false,
    },
});

export default apiRoute(async (req, matchedRoute, extraData) => {
    const config = await extraData.configManager.getConfig();

    return jsonResponse({
        http: {
            bind: config.http.bind,
            bind_port: config.http.bind_port,
            base_url: config.http.base_url,
            url: config.http.bind.includes("http")
                ? `${config.http.bind}:${config.http.bind_port}`
                : `http://${config.http.bind}:${config.http.bind_port}`,
        },
    });
});
