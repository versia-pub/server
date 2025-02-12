import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { Relationship as RelationshipSchema } from "~/classes/schemas/relationship";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/unmute",
    summary: "Unmute user",
    description: "Unmute a user",
    middleware: [
        auth({
            auth: true,
            scopes: ["write:mutes"],
            permissions: [
                RolePermissions.ManageOwnMutes,
                RolePermissions.ViewAccounts,
            ],
        }),
        withUserParam,
    ] as const,
    request: {
        params: z.object({
            id: z.string().uuid(),
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

        if (foundRelationship.data.muting) {
            await foundRelationship.update({
                muting: false,
                mutingNotifications: false,
            });
        }

        return context.json(foundRelationship.toApi(), 200);
    }),
);
