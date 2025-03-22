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
} from "@versia/client-ng/schemas";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/unfollow",
    summary: "Unfollow account",
    description: "Unfollow the given account.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#unfollow",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:follows"],
            permissions: [
                RolePermissions.ManageOwnFollows,
                RolePermissions.ViewAccounts,
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
                "Successfully unfollowed, or account was already not followed",
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

        await user.unfollow(otherUser, foundRelationship);

        return context.json(foundRelationship.toApi(), 200);
    }),
);
