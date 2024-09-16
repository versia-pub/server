import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Role } from "~/packages/database-interface/role";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: true,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/api/v1/roles",
});

const route = createRoute({
    method: "get",
    path: "/api/v1/roles",
    summary: "Get user roles",
    middleware: [auth(meta.auth)],
    responses: {
        200: {
            description: "User roles",
            content: {
                "application/json": {
                    schema: z.array(Role.schema),
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
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const userRoles = await Role.getUserRoles(user.id, user.data.isAdmin);

        return context.json(
            userRoles.map((r) => r.toApi()),
            200,
        );
    }),
);
