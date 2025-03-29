import { apiRoute, auth, withUserParam } from "@/api";
import { Relationship as RelationshipSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Relationship } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { ApiError } from "~/classes/errors/api-error";

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
