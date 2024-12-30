import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Relationship, User } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    route: "/api/v1/follow_requests/:account_id/reject",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnFollows],
    },
});

export const schemas = {
    param: z.object({
        account_id: z.string().uuid(),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/follow_requests/{account_id}/reject",
    summary: "Reject follow request",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnFollows],
        }),
    ] as const,
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Relationship",
            content: {
                "application/json": {
                    schema: Relationship.schema,
                },
            },
        },

        404: {
            description: "Account not found",
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
        const { user } = context.get("auth");

        const { account_id } = context.req.valid("param");

        const account = await User.fromId(account_id);

        if (!account) {
            throw new ApiError(404, "Account not found");
        }

        const oppositeRelationship = await Relationship.fromOwnerAndSubject(
            account,
            user,
        );

        await oppositeRelationship.update({
            requested: false,
            following: false,
        });

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            user,
            account,
        );

        // Check if rejecting remote follow
        if (account.isRemote()) {
            // Federate follow reject
            await user.sendFollowReject(account);
        }

        return context.json(foundRelationship.toApi(), 200);
    }),
);
