import { RolePermission, Role as RoleSchema } from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { Role } from "@versia-server/kit/db";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) => {
    app.get(
        "/api/v1/roles/:id",
        describeRoute({
            summary: "Get role data",
            tags: ["Roles"],
            responses: {
                200: {
                    description: "Role",
                    content: {
                        "application/json": {
                            schema: resolver(RoleSchema),
                        },
                    },
                },
                404: ApiError.roleNotFound().schema,
                403: ApiError.forbidden().schema,
            },
        }),
        auth({
            auth: true,
        }),
        validator("param", z.object({ id: z.uuid() }), handleZodError),
        async (context) => {
            const { id } = context.req.valid("param");

            const role = await Role.fromId(id);

            if (!role) {
                throw ApiError.roleNotFound();
            }

            return context.json(role.toApi(), 200);
        },
    );

    app.patch(
        "/api/v1/roles/:id",
        describeRoute({
            summary: "Update role data",
            tags: ["Roles"],
            responses: {
                204: {
                    description: "Role updated",
                },
                404: ApiError.roleNotFound().schema,
                403: ApiError.forbidden().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageRoles],
        }),
        validator(
            "param",
            z.object({
                id: z.uuid(),
            }),
            handleZodError,
        ),
        validator(
            "json",
            RoleSchema.omit({ id: true }).partial(),
            handleZodError,
        ),
        async (context) => {
            const { user } = context.get("auth");
            const { id } = context.req.valid("param");
            const { permissions, priority, description, icon, name, visible } =
                context.req.valid("json");

            const role = await Role.fromId(id);

            if (!role) {
                throw ApiError.roleNotFound();
            }

            // Priority check
            const userRoles = await Role.getUserRoles(
                user.id,
                user.data.isAdmin,
            );

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
                    permissions as unknown as RolePermission[]
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
                permissions,
                priority,
                description,
                icon,
                name,
                visible,
            });

            return context.body(null, 204);
        },
    );

    app.delete(
        "/api/v1/roles/:id",
        describeRoute({
            summary: "Delete role",
            tags: ["Roles"],
            responses: {
                204: {
                    description: "Role deleted",
                },
                404: ApiError.roleNotFound().schema,
                403: ApiError.forbidden().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageRoles],
        }),
        validator(
            "param",
            z.object({
                id: z.uuid(),
            }),
            handleZodError,
        ),
        async (context) => {
            const { user } = context.get("auth");
            const { id } = context.req.valid("param");

            const role = await Role.fromId(id);

            if (!role) {
                throw ApiError.roleNotFound();
            }

            // Priority check
            const userRoles = await Role.getUserRoles(
                user.id,
                user.data.isAdmin,
            );

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
        },
    );
});
