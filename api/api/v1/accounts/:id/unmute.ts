import {
    accountNotFound,
    apiRoute,
    auth,
    reusedResponses,
    withUserParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Account as AccountSchema,
    Relationship as RelationshipSchema,
} from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Relationship } from "@versia/kit/db";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/unmute",
    summary: "Unmute account",
    description: "Unmute the given account.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#unmute",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:mutes"],
            permissions: [
                RolePermission.ManageOwnMutes,
                RolePermission.ViewAccounts,
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
            description: "Successfully unmuted, or account was already unmuted",
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

        if (foundRelationship.data.muting) {
            await foundRelationship.update({
                muting: false,
                mutingNotifications: false,
            });
        }

        return context.json(foundRelationship.toApi(), 200);
    }),
);
