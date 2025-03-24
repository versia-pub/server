import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Account as AccountSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/refetch",
    summary: "Refetch account",
    description: "Refetch the given account's profile from the remote server",
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:accounts"],
            permissions: [RolePermission.ViewAccounts],
        }),
        withUserParam,
    ] as const,
    request: {
        params: z.object({
            id: AccountSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description: "Refetched account data",
            content: {
                "application/json": {
                    schema: AccountSchema,
                },
            },
        },
        400: {
            description: "User is local",
            content: {
                "application/json": {
                    schema: ApiError.zodSchema,
                },
            },
        },
        404: ApiError.accountNotFound().schema,
        401: ApiError.missingAuthentication().schema,
        422: ApiError.validationFailed().schema,
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
