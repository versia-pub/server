import { apiRoute, auth } from "@/api";
import { generateChallenge } from "@/challenges";
import { createRoute, z } from "@hono/zod-openapi";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";
import { ErrorSchema } from "~/types/api";

const route = createRoute({
    method: "post",
    path: "/api/v1/challenges",
    summary: "Generate a challenge",
    description: "Generate a challenge to solve",
    tags: ["Challenges"],
    middleware: [
        auth({
            auth: false,
        }),
    ] as const,
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
        if (!config.validation.challenges) {
            throw new ApiError(400, "Challenges are disabled in config");
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
