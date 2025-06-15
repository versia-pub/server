import {
    Relationship as RelationshipSchema,
    RolePermission,
} from "@versia/client/schemas";
import { Relationship } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { apiRoute, auth, withUserParam } from "@/api";

export default apiRoute((app) =>
    app.post(
        "/api/v1/accounts/:id/pin",
        describeRoute({
            summary: "Feature account on your profile",
            description:
                "Add the given account to the user’s featured profiles. (Featured profiles are currently shown on the user’s own public profile.)",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#pin",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description: "Updated relationship",
                    content: {
                        "application/json": {
                            schema: resolver(RelationshipSchema),
                        },
                    },
                },
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

            await foundRelationship.update({
                endorsed: true,
            });

            return context.json(foundRelationship.toApi(), 200);
        },
    ),
);
