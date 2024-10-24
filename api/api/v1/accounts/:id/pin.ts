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
    route: "/api/v1/accounts/:id/pin",
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
};

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/pin",
    summary: "Pin user",
    description: "Pin a user to your profile",
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

        await foundRelationship.update({
            endorsed: true,
        });

        return context.json(foundRelationship.toApi(), 200);
    }),
);
