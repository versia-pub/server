import { apiRoute, applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse, response } from "@/response";
import { zValidator } from "@hono/zod-validator";
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
export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user } = context.req.valid("header");
            const { id } = context.req.valid("param");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            const userRoles = await Role.getUserRoles(
                user.id,
                user.data.isAdmin,
            );
            const role = await Role.fromId(id);

            if (!role) {
                return errorResponse("Role not found", 404);
            }

            switch (context.req.method) {
                case "GET": {
                    return jsonResponse(role.toApi());
                }

                case "POST": {
                    const userHighestRole = userRoles.reduce((prev, current) =>
                        prev.data.priority > current.data.priority
                            ? prev
                            : current,
                    );

                    if (role.data.priority > userHighestRole.data.priority) {
                        return errorResponse(
                            `Cannot assign role '${
                                role.data.name
                            }' with priority ${
                                role.data.priority
                            } to user with highest role priority ${
                                userHighestRole.data.priority
                            }`,
                            403,
                        );
                    }

                    await role.linkUser(user.id);

                    return response(null, 204);
                }
                case "DELETE": {
                    const userHighestRole = userRoles.reduce((prev, current) =>
                        prev.data.priority > current.data.priority
                            ? prev
                            : current,
                    );

                    if (role.data.priority > userHighestRole.data.priority) {
                        return errorResponse(
                            `Cannot remove role '${
                                role.data.name
                            }' with priority ${
                                role.data.priority
                            } from user with highest role priority ${
                                userHighestRole.data.priority
                            }`,
                            403,
                        );
                    }

                    await role.unlinkUser(user.id);

                    return response(null, 204);
                }
            }
        },
    ),
);
