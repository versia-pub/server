import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Relationship, User } from "@versia/kit/db";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/unmute",
    auth: {
        required: true,
        oauthPermissions: ["write:mutes"],
    },
    permissions: {
        required: [
            RolePermissions.ManageOwnMutes,
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
    path: "/api/v1/accounts/{id}/unmute",
    summary: "Unmute user",
    description: "Unmute a user",
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
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");
        const { user: self } = context.get("auth");

        if (!self) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const user = await User.fromId(id);

        if (!user) {
            return context.json({ error: "User not found" }, 404);
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            self,
            user,
        );

        if (foundRelationship.data.muting) {
            await foundRelationship.update({
                muting: false,
                mutingNotifications: false,
            });
        }

        return context.json(foundRelationship.toApi(), 200);
    }),
);
