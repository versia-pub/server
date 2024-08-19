import { applyConfig } from "@/api";
import { jsonResponse } from "@/response";
import type { Hono } from "@hono/hono";
import manifest from "~/package.json";

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

export default (app: Hono) =>
    app.on(meta.allowedMethods, meta.route, () => {
        return jsonResponse({
            version: "2.0",
            software: { name: "versia-server", version: manifest.version },
            protocols: ["versia"],
            services: { outbound: [], inbound: [] },
            usage: {
                users: { total: 0, activeMonth: 0, activeHalfyear: 0 },
                localPosts: 0,
            },
            openRegistrations: false,
            metadata: {},
        });
    });
