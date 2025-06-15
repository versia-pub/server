import {
    Account as AccountSchema,
    RolePermission,
    Role as RoleSchema,
} from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { apiRoute, auth, handleZodError, withUserParam } from "@versia/kit/api";
import { Role } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { validator } from "hono-openapi/zod";
import { z } from "zod";

export default apiRoute((app) => {
    app.post(
        "/api/v1/accounts/:id/roles/:role_id",
        describeRoute({
            summary: "Assign role to account",
            tags: ["Accounts"],
            responses: {
                204: {
                    description: "Role assigned",
                },
                404: ApiError.roleNotFound().schema,
                403: ApiError.forbidden().schema,
            },
        }),
        withUserParam,
        validator(
            "param",
            z.object({
                id: AccountSchema.shape.id,
                role_id: RoleSchema.shape.id,
            }),
            handleZodError,
        ),
        auth({
            auth: true,
            permissions: [RolePermission.ManageRoles],
        }),
        async (context) => {
            const { user } = context.get("auth");
            const { role_id } = context.req.valid("param");
            const targetUser = context.get("user");

            const role = await Role.fromId(role_id);

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
                    `User with highest role priority ${userHighestRole.data.priority} cannot assign role with priority ${role.data.priority}`,
                );
            }

            await role.linkUser(targetUser.id);

            return context.body(null, 204);
        },
    );

    app.delete(
        "/api/v1/accounts/:id/roles/:role_id",
        describeRoute({
            summary: "Remove role from user",
            tags: ["Accounts"],
        }),
        withUserParam,
        validator(
            "param",
            z.object({
                id: AccountSchema.shape.id,
                role_id: RoleSchema.shape.id,
            }),
            handleZodError,
        ),
        auth({
            auth: true,
            permissions: [RolePermission.ManageRoles],
        }),
        async (context) => {
            const { user } = context.get("auth");
            const { role_id } = context.req.valid("param");
            const targetUser = context.get("user");

            const role = await Role.fromId(role_id);

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
                    `User with highest role priority ${userHighestRole.data.priority} cannot remove role with priority ${role.data.priority}`,
                );
            }

            await role.unlinkUser(targetUser.id);

            return context.body(null, 204);
        },
    );
});
