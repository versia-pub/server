import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Role, User } from "@versia/kit/db";
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
    route: "/api/v1/accounts/:id/roles/:role_id",
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
        role_id: z.string().uuid(),
    }),
};

const routePost = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/roles/{role_id}",
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
        404: {
            description: "User or role not found",
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
        404: {
            description: "User or role not found",
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
        const { id, role_id } = context.req.valid("param");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const targetUser = await User.fromId(id);
        const role = await Role.fromId(role_id);

        if (!role) {
            return context.json({ error: "Role not found" }, 404);
        }

        if (!targetUser) {
            return context.json({ error: "User not found" }, 404);
        }

        // Priority check
        const userRoles = await Role.getUserRoles(user.id, user.data.isAdmin);

        const userHighestRole = userRoles.reduce((prev, current) =>
            prev.data.priority > current.data.priority ? prev : current,
        );

        if (role.data.priority > userHighestRole.data.priority) {
            return context.json(
                {
                    error: `Cannot assign role '${role.data.name}' with priority ${role.data.priority} to user: your highest role priority is ${userHighestRole.data.priority}`,
                },
                403,
            );
        }

        await role.linkUser(targetUser.id);

        return context.text("", 204);
    });

    app.openapi(routeDelete, async (context) => {
        const { user } = context.get("auth");
        const { id, role_id } = context.req.valid("param");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const targetUser = await User.fromId(id);
        const role = await Role.fromId(role_id);

        if (!role) {
            return context.json({ error: "Role not found" }, 404);
        }

        if (!targetUser) {
            return context.json({ error: "User not found" }, 404);
        }

        // Priority check
        const userRoles = await Role.getUserRoles(user.id, user.data.isAdmin);

        const userHighestRole = userRoles.reduce((prev, current) =>
            prev.data.priority > current.data.priority ? prev : current,
        );

        if (role.data.priority > userHighestRole.data.priority) {
            return context.json(
                {
                    error: `Cannot remove role '${role.data.name}' with priority ${role.data.priority} from user: your highest role priority is ${userHighestRole.data.priority}`,
                },
                403,
            );
        }

        await role.unlinkUser(targetUser.id);

        return context.text("", 204);
    });
});
