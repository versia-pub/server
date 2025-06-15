import { Challenge } from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { config } from "@versia-server/config";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { apiRoute, auth } from "@/api";
import { generateChallenge } from "@/challenges";

export default apiRoute((app) =>
    app.post(
        "/api/v1/challenges",
        describeRoute({
            summary: "Generate a challenge",
            description: "Generate a challenge to solve",
            tags: ["Challenges"],
            responses: {
                200: {
                    description: "Challenge",
                    content: {
                        "application/json": {
                            schema: resolver(Challenge),
                        },
                    },
                },
                400: {
                    description: "Challenges are disabled",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
            },
        }),
        auth({
            auth: false,
        }),
        async (context) => {
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
        },
    ),
);
