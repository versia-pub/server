import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { RolePermissions } from "@versia/kit/tables";
import { ApiError } from "~/classes/errors/api-error";
import { Account } from "~/classes/schemas/account";
import { ErrorSchema } from "~/types/api";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/refetch",
    summary: "Refetch user",
    description: "Refetch a user's profile from the remote server",
    middleware: [
        auth({
            auth: true,
            scopes: ["write:accounts"],
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
            description: "Updated user data",
            content: {
                "application/json": {
                    schema: Account,
                },
            },
        },
        400: {
            description: "User is local",
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
        const otherUser = context.get("user");

        if (otherUser.isLocal()) {
            throw new ApiError(400, "Cannot refetch a local user");
        }

        const newUser = await otherUser.updateFromRemote();

        return context.json(newUser.toApi(false), 200);
    }),
);
