import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Relationship, User } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { ApiError } from "~/classes/errors/api-error";
import { Relationship as RelationshipSchema } from "~/classes/schemas/relationship";
import { ErrorSchema } from "~/types/api";

const schemas = {
    param: z.object({
        account_id: z.string().uuid(),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/follow_requests/{account_id}/authorize",
    summary: "Authorize follow request",
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
                    schema: RelationshipSchema,
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
            following: true,
        });

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            user,
            account,
        );

        // Check if accepting remote follow
        if (account.isRemote()) {
            // Federate follow accept
            await user.sendFollowAccept(account);
        }

        return context.json(foundRelationship.toApi(), 200);
    }),
);
