import { apiRoute, applyConfig, auth } from "@/api";
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

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async (context) => {
            return context.json(
                config.signups.rules.map((rule, index) => ({
                    id: String(index),
                    text: rule,
                    hint: "",
                })),
            );
        },
    ),
);
