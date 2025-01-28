import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";

const route = createRoute({
    method: "delete",
    path: "/api/v1/profile/avatar",
    summary: "Delete avatar",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnAccount],
            scopes: ["write:account"],
        }),
    ] as const,
    responses: {
        200: {
            description: "User",
            content: {
                "application/json": {
                    schema: User.schema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");

        await user.header?.delete();

        return context.json(user.toApi(true), 200);
    }),
);
