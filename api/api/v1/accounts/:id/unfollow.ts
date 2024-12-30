import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { ErrorSchema } from "~/types/api";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/unfollow",
    summary: "Unfollow user",
    description: "Unfollow a user",
    middleware: [
        auth({
            auth: true,
            scopes: ["write:follows"],
            permissions: [
                RolePermissions.ManageOwnFollows,
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
        500: {
            description: "Failed to unfollow user during federation",
            content: {
                "application/json": {
                    schema: ErrorSchema,
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

        await user.unfollow(otherUser, foundRelationship);

        return context.json(foundRelationship.toApi(), 200);
    }),
);
