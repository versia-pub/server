import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { Relationship } from "~/classes/database/relationship";
import { User } from "~/classes/database/user";
import { RolePermissions } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 30,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/note",
    auth: {
        required: true,
        oauthPermissions: ["write:accounts"],
    },
    permissions: {
        required: [
            RolePermissions.ManageOwnAccount,
            RolePermissions.ViewAccounts,
        ],
    },
});

export const schemas = {
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
    middleware: [auth(meta.auth, meta.permissions)],
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
        const { user } = context.get("auth");
        const { comment } = context.req.valid("json");

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

        await foundRelationship.update({
            note: comment,
        });

        return context.json(foundRelationship.toApi(), 200);
    }),
);
