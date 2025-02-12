import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { Relationship as RelationshipSchema } from "~/classes/schemas/relationship";

const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z.object({
        notifications: z.boolean().optional(),
        duration: z
            .number()
            .int()
            .min(60)
            .max(60 * 60 * 24 * 365 * 5)
            .optional(),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/mute",
    summary: "Mute user",
    description: "Mute a user",
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
                    schema: RelationshipSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
        // TODO: Add duration support
        const { notifications } = context.req.valid("json");
        const otherUser = context.get("user");

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            user,
            otherUser,
        );

        // TODO: Implement duration
        await foundRelationship.update({
            muting: true,
            mutingNotifications: notifications ?? true,
        });

        return context.json(foundRelationship.toApi(), 200);
    }),
);
