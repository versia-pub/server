import { apiRoute, applyConfig } from "@api";
import { redirect } from "@response";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 60,
    },
    route: "/.well-known/nodeinfo",
});

export default apiRoute(async (req, matchedRoute, extraData) => {
    const config = await extraData.configManager.getConfig();

    return redirect(
        new URL("/.well-known/nodeinfo/2.0", config.http.base_url),
        301,
    );
});
