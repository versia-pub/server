import { apiRoute, auth, handleZodError } from "@/api";
import { Role as RoleSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Role } from "@versia/kit/db";
import { randomUUIDv7 } from "bun";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";

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
