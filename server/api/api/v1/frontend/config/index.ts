import { apiRoute, applyConfig } from "@/api";
import { jsonResponse } from "@/response";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 120,
    },
    route: "/api/v1/frontend/config",
});

export default apiRoute((app) =>
    app.on(meta.allowedMethods, meta.route, () => {
        return jsonResponse(config.frontend.settings);
    }),
);
