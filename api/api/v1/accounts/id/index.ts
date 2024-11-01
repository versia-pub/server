import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { RolePermissions, Users } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/id",
    auth: {
        required: false,
        oauthPermissions: [],
    },
    permissions: {
        required: [RolePermissions.Search],
    },
});

export const schemas = {
    query: z.object({
        username: z.string().min(1).max(512),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/id",
    summary: "Get account by username",
    description: "Get an account by username",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Account",
            content: {
                "application/json": {
                    schema: User.schema,
                },
            },
        },
        404: {
            description: "Not found",
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
        const { username } = context.req.valid("query");

        const user = await User.fromSql(
            and(eq(Users.username, username), isNull(Users.instanceId)),
        );

        if (!user) {
            return context.json({ error: "User not found" }, 404);
        }

        return context.json(user.toApi(), 200);
    }),
);
