import {
    Relationship as RelationshipSchema,
    RolePermission,
} from "@versia/client/schemas";
import { Relationship } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { apiRoute, auth, withUserParam } from "@/api";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.post(
        "/api/v1/accounts/:id/unblock",
        describeRoute({
            summary: "Unblock account",
            description: "Unblock the given account.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#unblock",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description:
                        "Successfully unblocked, or account was already not blocked",
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
            scopes: ["write:blocks"],
            permissions: [
                RolePermission.ManageOwnBlocks,
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

            if (foundRelationship.data.blocking) {
                await foundRelationship.update({
                    blocking: false,
                });
            }

            return context.json(foundRelationship.toApi(), 200);
        },
    ),
);
