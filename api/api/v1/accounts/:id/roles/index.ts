import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Account as AccountSchema,
    Role as RoleSchema,
} from "@versia/client/schemas";
import { Role } from "@versia/kit/db";

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/{id}/roles",
    summary: "List account roles",
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: false,
        }),
        withUserParam,
    ] as const,
    request: {
        params: z.object({
            id: AccountSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description: "List of roles",
            content: {
                "application/json": {
                    schema: z.array(RoleSchema),
                },
            },
        },
    },
});

export default apiRoute((app) => {
    app.openapi(route, async (context) => {
        const targetUser = context.get("user");

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
