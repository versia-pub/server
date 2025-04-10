import { Relationship as RelationshipSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Relationship } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { apiRoute, auth, withUserParam } from "@/api";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.post(
        "/api/v1/accounts/:id/unpin",
        describeRoute({
            summary: "Unfeature account from profile",
            description:
                "Remove the given account from the user’s featured profiles.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#unpin",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description:
                        "Successfully unendorsed, or account was already not endorsed",
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
            scopes: ["write:accounts"],
            permissions: [
                RolePermission.ManageOwnAccount,
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

            if (foundRelationship.data.endorsed) {
                await foundRelationship.update({
                    endorsed: false,
                });
            }

            return context.json(foundRelationship.toApi(), 200);
        },
    ),
);
