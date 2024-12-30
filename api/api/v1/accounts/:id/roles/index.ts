import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Role, User } from "@versia/kit/db";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/{id}/roles",
    summary: "List user roles",
    middleware: [
        auth({
            auth: false,
        }),
    ] as const,
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
    },
    responses: {
        200: {
            description: "List of roles",
            content: {
                "application/json": {
                    schema: z.array(Role.schema),
                },
            },
        },
        404: {
            description: "User not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) => {
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");

        const targetUser = await User.fromId(id);

        if (!targetUser) {
            throw new ApiError(404, "User not found");
        }

        const roles = await Role.getUserRoles(
            targetUser.id,
            targetUser.data.isAdmin,
        );

        return context.json(
            roles.map((role) => role.toApi()),
            200,
        );
    });
});
