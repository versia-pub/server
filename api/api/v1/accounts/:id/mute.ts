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
    route: "/api/v1/accounts/:id/mute",
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
    middleware: [auth(meta.auth, meta.permissions)] as const,
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
        // TODO: Add duration support
        const { notifications } = context.req.valid("json");

        if (!user) {
            throw new ApiError(401, "Unauthorized");
        }

        const otherUser = await User.fromId(id);

        if (!otherUser) {
            throw new ApiError(404, "User not found");
        }

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
