import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Role } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";
import { RolePermissions } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    auth: {
        required: false,
        methodOverrides: {
            POST: true,
        },
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/api/v1/roles",
    permissions: {
        required: [],
        methodOverrides: {
            POST: [RolePermissions.ManageRoles],
        },
    },
});

const routeGet = createRoute({
    method: "get",
    path: "/api/v1/roles",
    summary: "Get all roles",
    middleware: [
        auth({
            auth: true,
        }),
    ] as const,
    responses: {
        200: {
            description: "List of all roles",
            content: {
                "application/json": {
                    schema: z.array(Role.schema),
                },
            },
        },
    },
});

const routePost = createRoute({
    method: "post",
    path: "/api/v1/roles",
    summary: "Create a new role",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageRoles],
        }),
    ] as const,
    request: {
        body: {
            content: {
                "application/json": {
                    schema: Role.schema.omit({ id: true }),
                },
            },
        },
    },
    responses: {
        201: {
            description: "Role created",
            content: {
                "application/json": {
                    schema: Role.schema,
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
        const roles = await Role.getAll();

        return context.json(
            roles.map((r) => r.toApi()),
            200,
        );
    });

    app.openapi(routePost, async (context) => {
        const { user } = context.get("auth");
        const { description, icon, name, permissions, priority, visible } =
            context.req.valid("json");

        // Priority check
        const userRoles = await Role.getUserRoles(user.id, user.data.isAdmin);

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
                permissions as unknown as RolePermissions[]
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
            description,
            icon,
            name,
            permissions: permissions as unknown as RolePermissions[],
            priority,
            visible,
        });

        return context.json(newRole.toApi(), 201);
    });
});
