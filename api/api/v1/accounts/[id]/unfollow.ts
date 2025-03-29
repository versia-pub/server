import { apiRoute, auth, withUserParam } from "@/api";
import { Relationship as RelationshipSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Relationship } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { ApiError } from "~/classes/errors/api-error";

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
