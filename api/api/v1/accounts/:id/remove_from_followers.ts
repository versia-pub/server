import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Account as AccountSchema,
    Relationship as RelationshipSchema,
} from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Relationship } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

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
                RolePermission.ManageOwnFollows,
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
                "Successfully removed from followers, or account was already not following you",
            content: {
                "application/json": {
                    schema: RelationshipSchema,
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
