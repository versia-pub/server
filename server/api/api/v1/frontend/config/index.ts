import { applyConfig } from "@/api";
import { jsonResponse } from "@/response";
import type { Hono } from "hono";
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

export default (app: Hono) =>
    app.on(meta.allowedMethods, meta.route, () => {
        return jsonResponse(config.frontend.settings);
    });
