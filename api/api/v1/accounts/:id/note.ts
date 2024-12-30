import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";

const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z.object({
        comment: z.string().min(0).max(5000).trim().optional(),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/note",
    summary: "Set note",
    description: "Set a note on a user's profile, visible only to you",
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
        params: schemas.param,
        body: {
            content: {
                "application/json": {
                    schema: schemas.json,
                },
            },
        },
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
        const { comment } = context.req.valid("json");
        const otherUser = context.get("user");

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            user,
            otherUser,
        );

        await foundRelationship.update({
            note: comment,
        });

        return context.json(foundRelationship.toApi(), 200);
    }),
);
