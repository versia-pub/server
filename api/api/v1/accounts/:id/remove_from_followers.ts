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
    path: "/api/v1/accounts/{id}/remove_from_followers",
    summary: "Remove account from followers",
    description: "Remove the given account from your followers.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#remove_from_followers",
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
                "Successfully removed from followers, or account was already not following you",
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

        const oppositeRelationship = await Relationship.fromOwnerAndSubject(
            otherUser,
            user,
        );

        if (oppositeRelationship.data.following) {
            await oppositeRelationship.update({
                following: false,
            });
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            user,
            otherUser,
        );

        return context.json(foundRelationship.toApi(), 200);
    }),
);
