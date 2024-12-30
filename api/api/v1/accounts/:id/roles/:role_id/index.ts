import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Role } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

const schemas = {
    param: z.object({
        id: z.string().uuid(),
        role_id: z.string().uuid(),
    }),
};

const routePost = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/roles/{role_id}",
    summary: "Assign role to user",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageRoles],
        }),
        withUserParam,
    ] as const,
    request: {
        params: schemas.param,
    },
    responses: {
        204: {
            description: "Role assigned",
        },
        404: {
            description: "Role not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        403: {
            description: "Forbidden",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

const routeDelete = createRoute({
    method: "delete",
    path: "/api/v1/accounts/{id}/roles/{role_id}",
    summary: "Remove role from user",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageRoles],
        }),
        withUserParam,
    ] as const,
    request: {
        params: schemas.param,
    },
    responses: {
        204: {
            description: "Role removed",
        },
        404: {
            description: "Role not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        403: {
            description: "Forbidden",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) => {
    app.openapi(routePost, async (context) => {
        const { user } = context.get("auth");
        const { role_id } = context.req.valid("param");
        const targetUser = context.get("user");

        const role = await Role.fromId(role_id);

        if (!role) {
            throw new ApiError(404, "Role not found");
        }
        // Priority check
        const userRoles = await Role.getUserRoles(user.id, user.data.isAdmin);

        const userHighestRole = userRoles.reduce((prev, current) =>
            prev.data.priority > current.data.priority ? prev : current,
        );

        if (role.data.priority > userHighestRole.data.priority) {
            throw new ApiError(
                403,
                "Forbidden",
                `User with highest role priority ${userHighestRole.data.priority} cannot assign role with priority ${role.data.priority}`,
            );
        }

        await role.linkUser(targetUser.id);

        return context.body(null, 204);
    });

    app.openapi(routeDelete, async (context) => {
        const { user } = context.get("auth");
        const { role_id } = context.req.valid("param");
        const targetUser = context.get("user");

        const role = await Role.fromId(role_id);

        if (!role) {
            throw new ApiError(404, "Role not found");
        }

        // Priority check
        const userRoles = await Role.getUserRoles(user.id, user.data.isAdmin);

        const userHighestRole = userRoles.reduce((prev, current) =>
            prev.data.priority > current.data.priority ? prev : current,
        );

        if (role.data.priority > userHighestRole.data.priority) {
            throw new ApiError(
                403,
                "Forbidden",
                `User with highest role priority ${userHighestRole.data.priority} cannot remove role with priority ${role.data.priority}`,
            );
        }

        await role.unlinkUser(targetUser.id);

        return context.body(null, 204);
    });
});
