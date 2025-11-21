import { RolePermission, Role as RoleSchema } from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { Role } from "@versia-server/kit/db";
import { randomUUIDv7 } from "bun";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

export default apiRoute((app) => {
    app.get(
        "/api/v1/roles",
        describeRoute({
            summary: "Get all roles",
            tags: ["Roles"],
            responses: {
                200: {
                    description: "List of all roles",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(RoleSchema)),
                        },
                    },
                },
            },
        }),
        auth({
            auth: true,
        }),
        async (context) => {
            const roles = await Role.getAll();

            return context.json(
                roles.map((r) => r.toApi()),
                200,
            );
        },
    );

    app.post(
        "/api/v1/roles",
        describeRoute({
            summary: "Create a new role",
            tags: ["Roles"],
            responses: {
                201: {
                    description: "Role created",
                    content: {
                        "application/json": {
                            schema: resolver(RoleSchema),
                        },
                    },
                },
                403: {
                    description: "Forbidden",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageRoles],
        }),
        validator("json", RoleSchema.omit({ id: true }), handleZodError),
        async (context) => {
            const { user } = context.get("auth");
            const { description, icon, name, permissions, priority, visible } =
                context.req.valid("json");

            // Priority check
            const userRoles = await Role.getUserRoles(
                user.id,
                user.data.isAdmin,
            );

            const userHighestRole = userRoles.reduce((prev, current) =>
                prev.data.priority > current.data.priority ? prev : current,
            );

            if (priority > userHighestRole.data.priority) {
                throw new ApiError(
                    403,
                    "Cannot create role with higher priority than your own",
                );
            }

            // When adding new permissions, the user must already have the permissions they wish to add
            if (permissions) {
                const userPermissions = user.getAllPermissions();
                const hasPermissions = (
                    permissions as unknown as RolePermission[]
                ).every((p) => userPermissions.includes(p));

                if (!hasPermissions) {
                    throw new ApiError(
                        403,
                        "Cannot create role with permissions you do not have",
                        `Forbidden permissions: ${permissions.join(", ")}`,
                    );
                }
            }

            const newRole = await Role.insert({
                id: randomUUIDv7(),
                description,
                icon,
                name,
                permissions: permissions as unknown as RolePermission[],
                priority,
                visible,
            });

            return context.json(newRole.toApi(), 201);
        },
    );
});
