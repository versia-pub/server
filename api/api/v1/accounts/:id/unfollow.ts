import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Relationship, User } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/unfollow",
    auth: {
        required: true,
        oauthPermissions: ["write:follows"],
    },
    permissions: {
        required: [
            RolePermissions.ManageOwnFollows,
            RolePermissions.ViewAccounts,
        ],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};

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
    ] as const,
    request: {
        params: schemas.param,
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
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
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
        const { id } = context.req.valid("param");
        const { user: self } = context.get("auth");

        if (!self) {
            throw new ApiError(401, "Unauthorized");
        }

        const otherUser = await User.fromId(id);

        if (!otherUser) {
            throw new ApiError(404, "User not found");
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            self,
            otherUser,
        );

        await self.unfollow(otherUser, foundRelationship);

        return context.json(foundRelationship.toApi(), 200);
    }),
);
