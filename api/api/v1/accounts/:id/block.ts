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
    route: "/api/v1/accounts/:id/block",
    auth: {
        required: true,
        oauthPermissions: ["write:blocks"],
    },
    permissions: {
        required: [
            RolePermissions.ManageOwnBlocks,
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
    path: "/api/v1/accounts/{id}/block",
    summary: "Block user",
    description: "Block a user",
    middleware: [auth(meta.auth, meta.permissions)],
    responses: {
        200: {
            description: "User blocked",
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
    },
    request: {
        params: schemas.param,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const otherUser = await User.fromId(id);

        if (!otherUser) {
            return context.json({ error: "User not found" }, 404);
        }

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
