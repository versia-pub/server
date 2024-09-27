import { apiRoute, applyConfig, auth } from "@/api";
import { generateChallenge } from "@/challenges";
import { createRoute, z } from "@hono/zod-openapi";
import { config } from "~/packages/config-manager";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
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

const route = createRoute({
    method: "post",
    path: "/api/v1/challenges",
    summary: "Generate a challenge",
    description: "Generate a challenge to solve",
    middleware: [auth(meta.auth, meta.permissions)],
    responses: {
        200: {
            description: "Challenge",
            content: {
                "application/json": {
                    schema: z.object({
                        id: z.string(),
                        algorithm: z.enum(["SHA-1", "SHA-256", "SHA-512"]),
                        challenge: z.string(),
                        maxnumber: z.number().optional(),
                        salt: z.string(),
                        signature: z.string(),
                    }),
                },
            },
        },
        400: {
            description: "Challenges are disabled",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        if (!config.validation.challenges.enabled) {
            return context.json(
                { error: "Challenges are disabled in config" },
                400,
            );
        }

        const result = await generateChallenge();

        return context.json(
            {
                id: result.id,
                ...result.challenge,
            },
            200,
        );
    }),
);
