import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Role, User } from "@versia/kit/db";
import { z } from "zod";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/api/v1/accounts/:id/roles",
    permissions: {
        required: [],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/{id}/roles",
    summary: "List user roles",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
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
            return context.json({ error: "User not found" }, 404);
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
