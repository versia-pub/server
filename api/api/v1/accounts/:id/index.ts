import {
    accountNotFound,
    apiRoute,
    auth,
    reusedResponses,
    withUserParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { RolePermissions } from "@versia/kit/tables";
import { Account } from "~/classes/schemas/account";
import { Account as AccountSchema } from "~/classes/schemas/account";

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/{id}",
    summary: "Get account",
    description: "View information about a profile.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#get",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: false,
            permissions: [RolePermissions.ViewAccounts],
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
            description:
                "The Account record will be returned. Note that acct of local users does not include the domain name.",
            content: {
                "application/json": {
                    schema: Account,
                },
            },
        },
        404: accountNotFound,
        422: reusedResponses[422],
    },
});

export default apiRoute((app) =>
    app.openapi(route, (context) => {
        const { user } = context.get("auth");
        const otherUser = context.get("user");

        return context.json(otherUser.toApi(user?.id === otherUser.id), 200);
    }),
);
