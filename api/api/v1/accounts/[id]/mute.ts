import {
    Relationship as RelationshipSchema,
    RolePermission,
} from "@versia/client/schemas";
import { Relationship } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { apiRoute, auth, handleZodError, withUserParam } from "@/api";
import { ApiError } from "~/classes/errors/api-error";
import {
    RelationshipJobType,
    relationshipQueue,
} from "~/classes/queues/relationships";

export default apiRoute((app) =>
    app.post(
        "/api/v1/accounts/:id/mute",
        describeRoute({
            summary: "Mute account",
            description:
                "Mute the given account. Clients should filter statuses and notifications from this account, if received (e.g. due to a boost in the Home timeline).",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#mute",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description:
                        "Successfully muted, or account was already muted. Note that you can call this API method again with notifications=false to update the relationship so that only statuses are muted.",
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
        withUserParam,
        auth({
            auth: true,
            scopes: ["write:mutes"],
            permissions: [
                RolePermission.ManageOwnMutes,
                RolePermission.ViewAccounts,
            ],
        }),
        validator(
            "json",
            z.object({
                notifications: z.boolean().default(true).openapi({
                    description: "Mute notifications in addition to statuses?",
                }),
                duration: z
                    .number()
                    .int()
                    .min(0)
                    .max(60 * 60 * 24 * 365 * 5)
                    .default(0)
                    .openapi({
                        description:
                            "How long the mute should last, in seconds. 0 means indefinite.",
                    }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { user } = context.get("auth");
            const { notifications, duration } = context.req.valid("json");
            const otherUser = context.get("user");

            const foundRelationship = await Relationship.fromOwnerAndSubject(
                user,
                otherUser,
            );

            await foundRelationship.update({
                muting: true,
                mutingNotifications: notifications,
            });

            if (duration > 0) {
                await relationshipQueue.add(
                    RelationshipJobType.Unmute,
                    {
                        ownerId: user.id,
                        subjectId: otherUser.id,
                    },
                    {
                        delay: duration * 1000,
                    },
                );
            }

            return context.json(foundRelationship.toApi(), 200);
        },
    ),
);
