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
        "/api/v1/accounts/:id/block",
        describeRoute({
            summary: "Block account",
            description:
                "Block the given account. Clients should filter statuses from this account if received (e.g. due to a boost in the Home timeline)",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#block",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description:
                        "Successfully blocked, or account was already blocked.",
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

            if (!foundRelationship.data.blocking) {
                await foundRelationship.update({
                    blocking: true,
                });
            }

            return context.json(foundRelationship.toApi(), 200);
        },
    ),
);
