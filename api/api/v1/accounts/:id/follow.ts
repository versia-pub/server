import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { iso631 } from "~/classes/schemas/common";

const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z
        .object({
            reblogs: z.coerce.boolean().optional(),
            notify: z.coerce.boolean().optional(),
            languages: z.array(iso631).optional(),
        })
        .optional()
        .default({ reblogs: true, notify: false, languages: [] }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/follow",
    summary: "Follow user",
    description: "Follow a user",
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
        params: schemas.param,
        body: {
            content: {
                "application/json": {
                    schema: schemas.json,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
        const { reblogs, notify, languages } = context.req.valid("json");
        const otherUser = context.get("user");

        let relationship = await Relationship.fromOwnerAndSubject(
            user,
            otherUser,
        );

        if (!relationship.data.following) {
            relationship = await user.followRequest(otherUser, {
                reblogs,
                notify,
                languages,
            });
        }

        return context.json(relationship.toApi(), 200);
    }),
);
