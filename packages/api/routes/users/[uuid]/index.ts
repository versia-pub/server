import { UserSchema } from "@versia/sdk/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, handleZodError } from "@versia-server/kit/api";
import { User } from "@versia-server/kit/db";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.get(
        "/users/:uuid",
        describeRoute({
            summary: "Get user data",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "User data",
                    content: {
                        "application/json": {
                            schema: resolver(UserSchema),
                        },
                    },
                },
                301: {
                    description:
                        "Redirect to user profile (for web browsers). Uses user-agent for detection.",
                },
                404: ApiError.accountNotFound().schema,
                403: {
                    description: "Cannot view users from remote instances",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
            },
        }),
        validator(
            "param",
            z.object({
                uuid: z.uuid(),
            }),
            handleZodError,
        ),
        // @ts-expect-error idk why this is happening and I don't care
        async (context) => {
            const { uuid } = context.req.valid("param");

            const user = await User.fromId(uuid);

            if (!user) {
                throw ApiError.accountNotFound();
            }

            if (user.remote) {
                throw new ApiError(403, "User is not on this instance");
            }

            // Try to detect a web browser and redirect to the user's profile page
            if (context.req.header("user-agent")?.includes("Mozilla")) {
                return context.redirect(user.toApi().url);
            }

            const userJson = user.toVersia();

            const { headers } = await user.sign(
                userJson,
                new URL(context.req.url),
                "GET",
            );

            return context.json(userJson, 200, headers.toJSON());
        },
    ),
);
