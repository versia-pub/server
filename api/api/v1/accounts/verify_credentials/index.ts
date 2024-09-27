import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { User } from "~/packages/database-interface/user";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    route: "/api/v1/accounts/verify_credentials",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:accounts"],
    },
});

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/verify_credentials",
    summary: "Verify credentials",
    description: "Get your own account information",
    middleware: [auth(meta.auth)],
    responses: {
        200: {
            description: "Account",
            content: {
                "application/json": {
                    schema: User.schema,
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, (context) => {
        // TODO: Add checks for disabled/unverified accounts
        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        return context.json(user.toApi(true), 200);
    }),
);
