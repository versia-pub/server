import {
    Account as AccountSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, withUserParam } from "@versia-server/kit/api";
import { User } from "@versia-server/kit/db";
import { describeRoute, resolver } from "hono-openapi";

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

            if (otherUser.local) {
                throw new ApiError(400, "Cannot refetch a local user");
            }

            const newUser = await User.fromVersia(otherUser.uri);

            return context.json(newUser.toApi(false), 200);
        },
    ),
);
