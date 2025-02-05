import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { RolePermissions } from "@versia/kit/tables";
import { Account } from "~/classes/schemas/account";

const route = createRoute({
    method: "delete",
    path: "/api/v1/profile/header",
    summary: "Delete header",
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
                    schema: Account,
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
