import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { User } from "~/classes/database/user";
import { RolePermissions } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 4,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/refetch",
    auth: {
        required: true,
        oauthPermissions: ["write:accounts"],
    },
    permissions: {
        required: [RolePermissions.ViewAccounts],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/refetch",
    summary: "Refetch user",
    description: "Refetch a user's profile from the remote server",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Updated user data",
            content: {
                "application/json": {
                    schema: User.schema,
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        404: {
            description: "User not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        400: {
            description: "User is local",
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
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const otherUser = await User.fromId(id);

        if (!otherUser) {
            return context.json({ error: "User not found" }, 404);
        }

        if (otherUser.isLocal()) {
            return context.json({ error: "Cannot refetch a local user" }, 400);
        }

        const newUser = await otherUser.updateFromRemote();

        return context.json(newUser.toApi(false), 200);
    }),
);
