import { apiRoute, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Relationship, User } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import ISO6391 from "iso-639-1";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z
        .object({
            reblogs: z.coerce.boolean().optional(),
            notify: z.coerce.boolean().optional(),
            languages: z
                .array(z.enum(ISO6391.getAllCodes() as [string, ...string[]]))
                .optional(),
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
        404: {
            description: "User not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
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
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");
        const { reblogs, notify, languages } = context.req.valid("json");

        const otherUser = await User.fromId(id);

        if (!otherUser) {
            throw new ApiError(404, "User not found");
        }

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
