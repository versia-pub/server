import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Account as AccountSchema,
    Relationship as RelationshipSchema,
} from "@versia/client-ng/schemas";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/pin",
    summary: "Feature account on your profile",
    description:
        "Add the given account to the user’s featured profiles. (Featured profiles are currently shown on the user’s own public profile.)",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#pin",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:accounts"],
            permissions: [
                RolePermissions.ManageOwnAccount,
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
            description: "Updated relationship",
            content: {
                "application/json": {
                    schema: RelationshipSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
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
    }),
);
