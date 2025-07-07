import {
    Relationship as RelationshipSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, withUserParam } from "@versia-server/kit/api";
import { Relationship } from "@versia-server/kit/db";
import { describeRoute, resolver } from "hono-openapi";

export default apiRoute((app) =>
    app.post(
        "/api/v1/accounts/:id/remove_from_followers",
        describeRoute({
            summary: "Remove account from followers",
            description: "Remove the given account from your followers.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#remove_from_followers",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description:
                        "Successfully removed from followers, or account was already not following you",
                    content: {
                        "application/json": {
                            schema: resolver(RelationshipSchema),
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
            scopes: ["write:follows"],
            permissions: [
                RolePermission.ManageOwnFollows,
                RolePermission.ViewAccounts,
            ],
        }),
        async (context) => {
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
        },
    ),
);
