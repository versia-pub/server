import {
    Account as AccountSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { apiRoute, auth, withUserParam } from "@/api";

export default apiRoute((app) =>
    app.get(
        "/api/v1/accounts/:id",
        describeRoute({
            summary: "Get account",
            description: "View information about a profile.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#get",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description:
                        "The Account record will be returned. Note that acct of local users does not include the domain name.",
                    content: {
                        "application/json": {
                            schema: resolver(AccountSchema),
                        },
                    },
                },
                404: ApiError.accountNotFound().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        withUserParam,
        auth({
            auth: false,
            permissions: [RolePermission.ViewAccounts],
        }),
        (context) => {
            const { user } = context.get("auth");
            const otherUser = context.get("user");

            return context.json(
                otherUser.toApi(user?.id === otherUser.id),
                200,
            );
        },
    ),
);
