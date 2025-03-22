import { accountNotFound, apiRoute, auth, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Account as AccountSchema } from "@versia/client-ng/schemas";
import { User } from "@versia/kit/db";
import { RolePermissions, Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/id",
    summary: "Get account by username",
    description: "Get an account by username",
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: false,
            permissions: [RolePermissions.Search],
        }),
    ] as const,
    request: {
        query: z.object({
            username: AccountSchema.shape.username.transform((v) =>
                v.toLowerCase(),
            ),
        }),
    },
    responses: {
        200: {
            description: "Account",
            content: {
                "application/json": {
                    schema: AccountSchema,
                },
            },
        },
        404: accountNotFound,
        422: reusedResponses[422],
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
