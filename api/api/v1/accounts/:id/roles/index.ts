import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Role } from "@versia/kit/db";
import { Role as RoleSchema } from "~/classes/schemas/versia.ts";

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/{id}/roles",
    summary: "List user roles",
    middleware: [
        auth({
            auth: false,
        }),
        withUserParam,
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
