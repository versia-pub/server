import {
    Account as AccountSchema,
    Relationship as RelationshipSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { apiRoute, auth, handleZodError } from "@versia/kit/api";
import { Relationship, User } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";

export default apiRoute((app) =>
    app.post(
        "/api/v1/follow_requests/:account_id/authorize",
        describeRoute({
            summary: "Accept follow request",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/follow_requests/#accept",
            },
            tags: ["Follows"],
            responses: {
                200: {
                    description:
                        "Your Relationship with this account should be updated so that you are followed_by this account.",
                    content: {
                        "application/json": {
                            schema: resolver(RelationshipSchema),
                        },
                    },
                },
                404: ApiError.accountNotFound().schema,
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnFollows],
        }),
        validator(
            "param",
            z.object({
                account_id: AccountSchema.shape.id,
            }),
            handleZodError,
        ),
        async (context) => {
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
            if (account.remote) {
                // Federate follow accept
                await user.acceptFollowRequest(account);
            }

            return context.json(foundRelationship.toApi(), 200);
        },
    ),
);
