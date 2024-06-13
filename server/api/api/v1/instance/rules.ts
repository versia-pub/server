import { applyConfig, auth } from "@/api";
import { jsonResponse } from "@/response";
import type { Hono } from "hono";
import { config } from "~/packages/config-manager";

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

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async (_context) => {
            return jsonResponse(
                config.signups.rules.map((rule, index) => ({
                    id: String(index),
                    text: rule,
                    hint: "",
                })),
            );
        },
    );
