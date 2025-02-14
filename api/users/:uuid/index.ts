import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { User as UserSchema } from "@versia/federation/schemas";
import { User } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

const schemas = {
    param: z.object({
        uuid: z.string().uuid(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/users/{uuid}",
    summary: "Get user data",
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "User data",
            content: {
                "application/json": {
                    schema: UserSchema,
                },
            },
        },
        301: {
            description:
                "Redirect to user profile (for web browsers). Uses user-agent for detection.",
        },
        404: {
            description: "User not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        403: {
            description: "Cannot view users from remote instances",
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
        const { uuid } = context.req.valid("param");

        const user = await User.fromId(uuid);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        if (user.isRemote()) {
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
    }),
);
