import { accountNotFound, apiRoute, auth, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Relationship, User } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { ApiError } from "~/classes/errors/api-error";
import { Account as AccountSchema } from "~/classes/schemas/account";
import { Relationship as RelationshipSchema } from "~/classes/schemas/relationship";

const route = createRoute({
    method: "post",
    path: "/api/v1/follow_requests/{account_id}/reject",
    summary: "Reject follow request",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/follow_requests/#reject",
    },
    tags: ["Follows"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnFollows],
        }),
    ] as const,
    request: {
        params: z.object({
            account_id: AccountSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description:
                "Your Relationship with this account should be unchanged.",
            content: {
                "application/json": {
                    schema: RelationshipSchema,
                },
            },
        },
        404: accountNotFound,
        ...reusedResponses,
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
