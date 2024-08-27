import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { Relationship } from "~/packages/database-interface/relationship";
import { User } from "~/packages/database-interface/user";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    allowedMethods: ["POST"],
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
    middleware: [auth(meta.auth, meta.permissions)],
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
            return context.json({ error: "Unauthorized" }, 401);
        }

        const otherUser = await User.fromId(id);

        if (!otherUser) {
            return context.json({ error: "User not found" }, 404);
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            self,
            otherUser,
        );

        if (!(await self.unfollow(otherUser, foundRelationship))) {
            return context.json({ error: "Failed to unfollow user" }, 500);
        }

        return context.json(foundRelationship.toApi(), 200);
    }),
);
