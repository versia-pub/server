import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";

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
                    schema: User.schema,
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
