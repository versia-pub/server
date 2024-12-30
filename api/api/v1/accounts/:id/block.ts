import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/block",
    summary: "Block user",
    description: "Block a user",
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
    responses: {
        200: {
            description: "Updated relationship",
            content: {
                "application/json": {
                    schema: Relationship.schema,
                },
            },
        },
    },
    request: {
        params: z.object({
            id: z.string().uuid(),
        }),
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

        if (!foundRelationship.data.blocking) {
            await foundRelationship.update({
                blocking: true,
            });
        }

        return context.json(foundRelationship.toApi(), 200);
    }),
);
