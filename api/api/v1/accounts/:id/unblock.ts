import {
    accountNotFound,
    apiRoute,
    auth,
    reusedResponses,
    withUserParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { Account as AccountSchema } from "~/classes/schemas/account";
import { Relationship as RelationshipSchema } from "~/classes/schemas/relationship";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/unblock",
    summary: "Unblock account",
    description: "Unblock the given account.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#unblock",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:blocks"],
            permissions: [
                RolePermissions.ManageOwnBlocks,
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
            description:
                "Successfully unblocked, or account was already not blocked",
            content: {
                "application/json": {
                    schema: RelationshipSchema,
                },
            },
        },
        404: accountNotFound,
        ...reusedResponses,
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

        if (foundRelationship.data.blocking) {
            await foundRelationship.update({
                blocking: false,
            });
        }

        return context.json(foundRelationship.toApi(), 200);
    }),
);
