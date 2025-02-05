import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { RolePermissions } from "@versia/kit/tables";
import { Account } from "~/classes/schemas/account";

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/{id}",
    summary: "Get account data",
    description: "Gets the specified account data",
    middleware: [
        auth({
            auth: false,
            permissions: [RolePermissions.ViewAccounts],
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
            description: "Account data",
            content: {
                "application/json": {
                    schema: Account,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, (context) => {
        const { user } = context.get("auth");
        const otherUser = context.get("user");

        return context.json(otherUser.toApi(user?.id === otherUser.id), 200);
    }),
);
