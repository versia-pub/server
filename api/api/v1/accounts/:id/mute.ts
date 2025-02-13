import {
    accountNotFound,
    apiRoute,
    auth,
    reusedResponses,
    withUserParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { Account as AccountSchema } from "~/classes/schemas/account";
import { Relationship as RelationshipSchema } from "~/classes/schemas/relationship";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/mute",
    summary: "Mute account",
    description:
        "Mute the given account. Clients should filter statuses and notifications from this account, if received (e.g. due to a boost in the Home timeline).",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#mute",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:mutes"],
            permissions: [
                RolePermissions.ManageOwnMutes,
                RolePermissions.ViewAccounts,
            ],
        }),
        withUserParam,
    ] as const,
    request: {
        params: z.object({
            id: AccountSchema.shape.id,
        }),
        body: {
            content: {
                "application/json": {
                    schema: z.object({
                        notifications: z.boolean().default(true).openapi({
                            description:
                                "Mute notifications in addition to statuses?",
                        }),
                        duration: z
                            .number()
                            .int()
                            .min(0)
                            .max(60 * 60 * 24 * 365 * 5)
                            .default(0)
                            .openapi({
                                description:
                                    "How long the mute should last, in seconds.",
                            }),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description:
                "Successfully muted, or account was already muted. Note that you can call this API method again with notifications=false to update the relationship so that only statuses are muted.",
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
        // TODO: Add duration support
        const { notifications } = context.req.valid("json");
        const otherUser = context.get("user");

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            user,
            otherUser,
        );

        // TODO: Implement duration
        await foundRelationship.update({
            muting: true,
            mutingNotifications: notifications,
        });

        return context.json(foundRelationship.toApi(), 200);
    }),
);
