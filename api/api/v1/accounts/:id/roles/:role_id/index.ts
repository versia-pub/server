import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Account as AccountSchema,
    Role as RoleSchema,
} from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Role } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

const routePost = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/roles/{role_id}",
    summary: "Assign role to account",
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermission.ManageRoles],
        }),
        withUserParam,
    ] as const,
    request: {
        params: z.object({
            id: AccountSchema.shape.id,
            role_id: RoleSchema.shape.id,
        }),
    },
    responses: {
        204: {
            description: "Role assigned",
        },
        404: ApiError.roleNotFound().schema,
        403: ApiError.forbidden().schema,
    },
});

const routeDelete = createRoute({
    method: "delete",
    path: "/api/v1/accounts/{id}/roles/{role_id}",
    summary: "Remove role from user",
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermission.ManageRoles],
        }),
        withUserParam,
    ] as const,
    request: {
        params: z.object({
            id: AccountSchema.shape.id,
            role_id: RoleSchema.shape.id,
        }),
    },
    responses: {
        204: {
            description: "Role removed",
        },
        404: ApiError.roleNotFound().schema,
        403: ApiError.forbidden().schema,
    },
});

export default apiRoute((app) => {
    app.openapi(routePost, async (context) => {
        const { user } = context.get("auth");
        const { role_id } = context.req.valid("param");
        const targetUser = context.get("user");

        const role = await Role.fromId(role_id);

        if (!role) {
            throw ApiError.roleNotFound();
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
            throw ApiError.roleNotFound();
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
