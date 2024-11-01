import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Role } from "@versia/kit/db";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
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

const routePost = createRoute({
    method: "post",
    path: "/api/v1/roles/{id}",
    summary: "Assign role to user",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
    },
    responses: {
        204: {
            description: "Role assigned",
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

const routeDelete = createRoute({
    method: "delete",
    path: "/api/v1/roles/{id}",
    summary: "Remove role from user",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
    },
    responses: {
        204: {
            description: "Role removed",
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

    app.openapi(routePost, async (context) => {
        const { user } = context.get("auth");
        const { id } = context.req.valid("param");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const userRoles = await Role.getUserRoles(user.id, user.data.isAdmin);
        const role = await Role.fromId(id);

        if (!role) {
            return context.json({ error: "Role not found" }, 404);
        }

        const userHighestRole = userRoles.reduce((prev, current) =>
            prev.data.priority > current.data.priority ? prev : current,
        );

        if (role.data.priority > userHighestRole.data.priority) {
            return context.json(
                {
                    error: `Cannot assign role '${role.data.name}' with priority ${role.data.priority} to user with highest role priority ${userHighestRole.data.priority}`,
                },
                403,
            );
        }

        await role.linkUser(user.id);

        return context.newResponse(null, 204);
    });

    app.openapi(routeDelete, async (context) => {
        const { user } = context.get("auth");
        const { id } = context.req.valid("param");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const userRoles = await Role.getUserRoles(user.id, user.data.isAdmin);
        const role = await Role.fromId(id);

        if (!role) {
            return context.json({ error: "Role not found" }, 404);
        }

        const userHighestRole = userRoles.reduce((prev, current) =>
            prev.data.priority > current.data.priority ? prev : current,
        );

        if (role.data.priority > userHighestRole.data.priority) {
            return context.json(
                {
                    error: `Cannot remove role '${role.data.name}' with priority ${role.data.priority} from user with highest role priority ${userHighestRole.data.priority}`,
                },
                403,
            );
        }

        await role.unlinkUser(user.id);

        return context.newResponse(null, 204);
    });
});
