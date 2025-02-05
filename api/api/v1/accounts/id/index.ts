import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";
import { Account } from "~/classes/schemas/account";
import { ErrorSchema } from "~/types/api";

const schemas = {
    query: z.object({
        username: z.string().min(1).max(512).toLowerCase(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/id",
    summary: "Get account by username",
    description: "Get an account by username",
    middleware: [
        auth({
            auth: false,
            permissions: [RolePermissions.Search],
        }),
    ] as const,
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Account",
            content: {
                "application/json": {
                    schema: Account,
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
            throw new ApiError(404, "User not found");
        }

        return context.json(user.toApi(), 200);
    }),
);
