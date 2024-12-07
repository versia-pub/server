import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Role } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    auth: {
        required: true,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/api/v1/roles/:id",
    permissions: {
        required: [],
        methodOverrides: {
            POST: [RolePermissions.ManageRoles],
            DELETE: [RolePermissions.ManageRoles],
        },
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};

const routeGet = createRoute({
    method: "get",
    path: "/api/v1/roles/{id}",
    summary: "Get role data",
    middleware: [auth(meta.auth)],
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Role",
            content: {
                "application/json": {
                    schema: Role.schema,
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
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
        body: {
            content: {
                "application/json": {
                    schema: Role.schema.partial(),
                },
            },
        },
    },
    responses: {
        204: {
            description: "Role updated",
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
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
    },
    responses: {
        204: {
            description: "Role deleted",
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
        const { user } = context.get("auth");
        const { id } = context.req.valid("param");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const role = await Role.fromId(id);

        if (!role) {
            return context.json({ error: "Role not found" }, 404);
        }

        return context.json(role.toApi(), 200);
    });

    app.openapi(routePatch, async (context) => {
        const { user } = context.get("auth");
        const { id } = context.req.valid("param");
        const { permissions, priority, description, icon, name, visible } =
            context.req.valid("json");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const role = await Role.fromId(id);

        if (!role) {
            return context.json({ error: "Role not found" }, 404);
        }

        // Priority check
        const userRoles = await Role.getUserRoles(user.id, user.data.isAdmin);

        const userHighestRole = userRoles.reduce((prev, current) =>
            prev.data.priority > current.data.priority ? prev : current,
        );

        if (role.data.priority > userHighestRole.data.priority) {
            return context.json(
                {
                    error: `Cannot edit role '${role.data.name}' with priority ${role.data.priority}: your highest role priority is ${userHighestRole.data.priority}`,
                },
                403,
            );
        }

        // If updating role permissions, the user must already have the permissions they wish to add/remove
        if (permissions) {
            const userPermissions = user.getAllPermissions();
            const hasPermissions = (
                permissions as unknown as RolePermissions[]
            ).every((p) => userPermissions.includes(p));

            if (!hasPermissions) {
                return context.json(
                    {
                        error: `You cannot add or remove the following permissions you do not yourself have: ${permissions.join(", ")}`,
                    },
                    403,
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

        return context.text("", 204);
    });

    app.openapi(routeDelete, async (context) => {
        const { user } = context.get("auth");
        const { id } = context.req.valid("param");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const role = await Role.fromId(id);

        if (!role) {
            return context.json({ error: "Role not found" }, 404);
        }

        // Priority check
        const userRoles = await Role.getUserRoles(user.id, user.data.isAdmin);

        const userHighestRole = userRoles.reduce((prev, current) =>
            prev.data.priority > current.data.priority ? prev : current,
        );

        if (role.data.priority > userHighestRole.data.priority) {
            return context.json(
                {
                    error: `Cannot delete role '${role.data.name}' with priority ${role.data.priority}: your highest role priority is ${userHighestRole.data.priority}`,
                },
                403,
            );
        }

        await role.delete();

        return context.text("", 204);
    });
});
