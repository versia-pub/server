import { applyConfig, auth, handleZodError, jsonOrForm } from "@/api";
import { errorResponse, jsonResponse, response } from "@/response";
import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { Role } from "~/packages/database-interface/role";

export const meta = applyConfig({
    allowedMethods: ["GET", "POST", "DELETE"],
    auth: {
        required: true,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/api/v1/roles/:id",
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};
export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        jsonOrForm(),
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth),
        async (context) => {
            const { user } = context.req.valid("header");
            const { id } = context.req.valid("param");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            const userRoles = await Role.getUserRoles(user.id);
            const role = await Role.fromId(id);

            if (!role) {
                return errorResponse("Role not found", 404);
            }

            switch (context.req.method) {
                case "GET": {
                    return jsonResponse(role.toAPI());
                }

                case "POST": {
                    // Check if user has MANAGE_ROLES permission
                    if (
                        !userRoles.some((r) =>
                            r
                                .getRole()
                                .permissions.includes(
                                    RolePermissions.MANAGE_ROLES,
                                ),
                        )
                    ) {
                        return errorResponse(
                            "You do not have permission to manage roles",
                            403,
                        );
                    }

                    const userHighestRole = userRoles.reduce((prev, current) =>
                        prev.getRole().priority > current.getRole().priority
                            ? prev
                            : current,
                    );

                    if (
                        role.getRole().priority >
                        userHighestRole.getRole().priority
                    ) {
                        return errorResponse(
                            `Cannot assign role '${
                                role.getRole().name
                            }' with priority ${
                                role.getRole().priority
                            } to user with highest role priority ${
                                userHighestRole.getRole().priority
                            }`,
                            403,
                        );
                    }

                    await role.linkUser(user.id);

                    return response(null, 204);
                }
                case "DELETE": {
                    // Check if user has MANAGE_ROLES permission
                    if (
                        !userRoles.some((r) =>
                            r
                                .getRole()
                                .permissions.includes(
                                    RolePermissions.MANAGE_ROLES,
                                ),
                        )
                    ) {
                        return errorResponse(
                            "You do not have permission to manage roles",
                            403,
                        );
                    }

                    const userHighestRole = userRoles.reduce((prev, current) =>
                        prev.getRole().priority > current.getRole().priority
                            ? prev
                            : current,
                    );

                    if (
                        role.getRole().priority >
                        userHighestRole.getRole().priority
                    ) {
                        return errorResponse(
                            `Cannot remove role '${
                                role.getRole().name
                            }' with priority ${
                                role.getRole().priority
                            } from user with highest role priority ${
                                userHighestRole.getRole().priority
                            }`,
                            403,
                        );
                    }

                    await role.unlinkUser(user.id);

                    return response(null, 204);
                }
            }
        },
    );
