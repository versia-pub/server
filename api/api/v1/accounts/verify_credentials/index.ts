import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Account } from "~/classes/schemas/account";

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/verify_credentials",
    summary: "Verify credentials",
    description: "Get your own account information",
    middleware: [
        auth({
            auth: true,
            scopes: ["read:accounts"],
        }),
    ] as const,
    responses: {
        200: {
            description: "Account",
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
        // TODO: Add checks for disabled/unverified accounts
        const { user } = context.get("auth");

        return context.json(user.toApi(true), 200);
    }),
);
