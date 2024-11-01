import { apiRoute, applyConfig } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { User as UserSchema } from "@versia/federation/schemas";
import { User } from "@versia/kit/db";
import { z } from "zod";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/users/:uuid",
});

export const schemas = {
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
            return context.json({ error: "User not found" }, 404);
        }

        if (user.isRemote()) {
            return context.json(
                { error: "Cannot view users from remote instances" },
                403,
            );
        }

        // Try to detect a web browser and redirect to the user's profile page
        if (context.req.header("user-agent")?.includes("Mozilla")) {
            return context.redirect(user.toApi().url);
        }

        const userJson = user.toVersia();

        const { headers } = await user.sign(userJson, context.req.url, "GET");

        return context.json(userJson, 200, headers.toJSON());
    }),
);
