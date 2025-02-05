import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/pin",
    summary: "Pin user",
    description: "Pin a user to your profile",
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
            id: z.string().uuid(),
        }),
    },
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
