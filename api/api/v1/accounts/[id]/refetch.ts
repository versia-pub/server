import { apiRoute, auth, withUserParam } from "@/api";
import { Account as AccountSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { User } from "~/classes/database/user";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.post(
        "/api/v1/accounts/:id/refetch",
        describeRoute({
            summary: "Refetch account",
            description:
                "Refetch the given account's profile from the remote server",
            tags: ["Accounts"],
            responses: {
                200: {
                    description: "Refetched account data",
                    content: {
                        "application/json": {
                            schema: resolver(AccountSchema),
                        },
                    },
                },
                400: {
                    description: "User is local",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
                404: ApiError.accountNotFound().schema,
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        withUserParam,
        auth({
            auth: true,
            scopes: ["write:accounts"],
            permissions: [RolePermission.ViewAccounts],
        }),
        async (context) => {
            const otherUser = context.get("user");

            if (otherUser.isLocal()) {
                throw new ApiError(400, "Cannot refetch a local user");
            }

            const newUser = await User.fromVersia(otherUser.uri);

            return context.json(newUser.toApi(false), 200);
        },
    ),
);
