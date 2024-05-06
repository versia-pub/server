import { applyConfig } from "@api";
import { jsonResponse } from "@response";
import type { Hono } from "hono";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 10,
    },
    route: "/oauth/providers",
});

export default (app: Hono) =>
    app.on(meta.allowedMethods, meta.route, async () => {
        return jsonResponse([
            {
                name: "GitHub",
                icon: "github",
                id: "github",
            },
            {
                name: "Google",
                icon: "google",
                id: "google",
            },
        ]);
    });
