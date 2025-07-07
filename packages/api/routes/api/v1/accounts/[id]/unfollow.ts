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
        "/api/v1/accounts/:id/unfollow",
        describeRoute({
            summary: "Unfollow account",
            description: "Unfollow the given account.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#unfollow",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description:
                        "Successfully unfollowed, or account was already not followed",
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

            const foundRelationship = await Relationship.fromOwnerAndSubject(
                user,
                otherUser,
            );

            await user.unfollow(otherUser, foundRelationship);

            return context.json(foundRelationship.toApi(), 200);
        },
    ),
);
