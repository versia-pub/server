import { applyConfig } from "@/api";
import { jsonResponse } from "@/response";
import type { Hono } from "hono";
import { config } from "~/packages/config-manager";

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

export default (app: Hono) =>
    app.on(meta.allowedMethods, meta.route, async (context) => {
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
