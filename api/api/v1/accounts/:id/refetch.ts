import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
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
    middleware: [
        auth({
            auth: true,
            scopes: ["write:accounts"],
            permissions: [RolePermissions.ViewAccounts],
        }),
    ] as const,
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
            throw new ApiError(401, "Unauthorized");
        }

        const otherUser = await User.fromId(id);

        if (!otherUser) {
            throw new ApiError(404, "User not found");
        }

        if (otherUser.isLocal()) {
            throw new ApiError(400, "Cannot refetch a local user");
        }

        const newUser = await otherUser.updateFromRemote();

        return context.json(newUser.toApi(false), 200);
    }),
);
