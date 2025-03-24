import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Account as AccountSchema,
    Relationship as RelationshipSchema,
} from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Relationship, User } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "post",
    path: "/api/v1/follow_requests/{account_id}/authorize",
    summary: "Accept follow request",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/follow_requests/#accept",
    },
    tags: ["Follows"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnFollows],
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
                "Your Relationship with this account should be updated so that you are followed_by this account.",
            content: {
                "application/json": {
                    schema: RelationshipSchema,
                },
            },
        },
        404: ApiError.accountNotFound().schema,
        401: ApiError.missingAuthentication().schema,
        422: ApiError.validationFailed().schema,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");

        const { account_id } = context.req.valid("param");

        const account = await User.fromId(account_id);

        if (!account) {
            throw ApiError.accountNotFound();
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
