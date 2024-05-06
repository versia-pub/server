import { applyConfig } from "@api";
import { jsonResponse } from "@response";
import type { Hono } from "hono";
import { config } from "~packages/config-manager";

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
        return jsonResponse(
            config.oidc.providers.map((p) => ({
                name: p.name,
                icon: p.icon,
                id: p.id,
            })),
        );
    });
