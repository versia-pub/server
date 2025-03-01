import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Role } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { ApiError } from "~/classes/errors/api-error";
import { Role as RoleSchema } from "~/classes/schemas/versia.ts";
import { ErrorSchema } from "~/types/api";

const routeGet = createRoute({
    method: "get",
    path: "/api/v1/roles/{id}",
    summary: "Get role data",
    middleware: [
        auth({
            auth: true,
        }),
    ],
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
    },
    responses: {
        200: {
            description: "Role",
            content: {
                "application/json": {
                    schema: RoleSchema,
                },
            },
        },

        404: {
            description: "Role not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

const routePatch = createRoute({
    method: "patch",
    path: "/api/v1/roles/{id}",
    summary: "Update role data",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageRoles],
        }),
    ] as const,
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
        body: {
            content: {
                "application/json": {
                    schema: RoleSchema.omit({ id: true }).partial(),
                },
            },
        },
    },
    responses: {
        204: {
            description: "Role updated",
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
    path: "/api/v1/roles/{id}",
    summary: "Delete role",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageRoles],
        }),
    ] as const,
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
    },
    responses: {
        204: {
            description: "Role deleted",
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
    app.openapi(routeGet, async (context) => {
        const { id } = context.req.valid("param");

        const role = await Role.fromId(id);

        if (!role) {
            throw new ApiError(404, "Role not found");
        }

        return context.json(role.toApi(), 200);
    });

    app.openapi(routePatch, async (context) => {
        const { user } = context.get("auth");
        const { id } = context.req.valid("param");
        const { permissions, priority, description, icon, name, visible } =
            context.req.valid("json");

        const role = await Role.fromId(id);

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
                `User with highest role priority ${userHighestRole.data.priority} cannot edit role with priority ${role.data.priority}`,
            );
        }

        // If updating role permissions, the user must already have the permissions they wish to add/remove
        if (permissions) {
            const userPermissions = user.getAllPermissions();
            const hasPermissions = (
                permissions as unknown as RolePermissions[]
            ).every((p) => userPermissions.includes(p));

            if (!hasPermissions) {
                throw new ApiError(
                    403,
                    "Forbidden",
                    "User cannot add or remove permissions they do not have",
                );
            }
        }

        await role.update({
            permissions: permissions as unknown as RolePermissions[],
            priority,
            description,
            icon,
            name,
            visible,
        });

        return context.body(null, 204);
    });

    app.openapi(routeDelete, async (context) => {
        const { user } = context.get("auth");
        const { id } = context.req.valid("param");

        const role = await Role.fromId(id);

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
                `User with highest role priority ${userHighestRole.data.priority} cannot delete role with priority ${role.data.priority}`,
            );
        }

        await role.delete();

        return context.body(null, 204);
    });
});
