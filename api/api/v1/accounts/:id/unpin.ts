import {
    accountNotFound,
    apiRoute,
    auth,
    reusedResponses,
    withUserParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Account as AccountSchema,
    Relationship as RelationshipSchema,
} from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Relationship } from "@versia/kit/db";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/unpin",
    summary: "Unfeature account from profile",
    description: "Remove the given account from the user’s featured profiles.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#unpin",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:accounts"],
            permissions: [
                RolePermission.ManageOwnAccount,
                RolePermission.ViewAccounts,
            ],
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
                "Successfully unendorsed, or account was already not endorsed",
            content: {
                "application/json": {
                    schema: RelationshipSchema,
                },
            },
        },
        404: accountNotFound,
        ...reusedResponses,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
        const otherUser = context.get("user");

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            user,
            otherUser,
        );

        if (foundRelationship.data.endorsed) {
            await foundRelationship.update({
                endorsed: false,
            });
        }

        return context.json(foundRelationship.toApi(), 200);
    }),
);
