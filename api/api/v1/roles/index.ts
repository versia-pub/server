import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Role } from "@versia/kit/db";
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
    middleware: [auth(meta.auth)],
    responses: {
        200: {
            description: "List of all roles",
            content: {
                "application/json": {
                    schema: z.array(Role.schema),
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
    },
});

const routePost = createRoute({
    method: "post",
    path: "/api/v1/roles",
    summary: "Create a new role",
    middleware: [auth(meta.auth, meta.permissions)],
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
        401: {
            description: "Unauthorized",
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

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

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

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        // Priority check
        const userRoles = await Role.getUserRoles(user.id, user.data.isAdmin);

        const userHighestRole = userRoles.reduce((prev, current) =>
            prev.data.priority > current.data.priority ? prev : current,
        );

        if (priority > userHighestRole.data.priority) {
            return context.json(
                {
                    error: "You cannot create a role with higher priority than your own",
                },
                403,
            );
        }

        // When adding new permissions, the user must already have the permissions they wish to add
        if (permissions) {
            const userPermissions = user.getAllPermissions();
            const hasPermissions = (
                permissions as unknown as RolePermissions[]
            ).every((p) => userPermissions.includes(p));

            if (!hasPermissions) {
                return context.json(
                    {
                        error: `You cannot create a role with the following permissions you do not yourself have: ${permissions.join(", ")}`,
                    },
                    403,
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
