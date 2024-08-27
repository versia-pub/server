import { apiRoute, applyConfig, auth } from "@/api";
import { generateChallenge } from "@/challenges";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    route: "/api/v1/challenges",
    ratelimits: {
        max: 10,
        duration: 60,
    },
    auth: {
        required: false,
    },
    permissions: {
        required: [],
    },
});

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async (context) => {
            if (!config.validation.challenges.enabled) {
                return context.json(
                    { error: "Challenges are disabled in config" },
                    400,
                );
            }

            const result = await generateChallenge();

            return context.json({
                id: result.id,
                ...result.challenge,
            });
        },
    ),
);
