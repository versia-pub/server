import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Account as AccountSchema,
    Relationship as RelationshipSchema,
    iso631,
} from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Relationship } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/follow",
    summary: "Follow account",
    description:
        "Follow the given account. Can also be used to update whether to show reblogs or enable notifications.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#follow",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:follows"],
            permissions: [
                RolePermission.ManageOwnFollows,
                RolePermission.ViewAccounts,
            ],
        }),
        withUserParam,
    ] as const,
    responses: {
        200: {
            description:
                "Successfully followed, or account was already followed",
            content: {
                "application/json": {
                    schema: RelationshipSchema,
                },
            },
        },
        403: {
            description:
                "Trying to follow someone that you block or that blocks you",
            content: {
                "application/json": {
                    schema: ApiError.zodSchema,
                },
            },
        },
        404: ApiError.accountNotFound().schema,
        401: ApiError.missingAuthentication().schema,
        422: ApiError.validationFailed().schema,
    },
    request: {
        params: z.object({
            id: AccountSchema.shape.id,
        }),
        body: {
            content: {
                "application/json": {
                    schema: z.object({
                        reblogs: z.boolean().default(true).openapi({
                            description:
                                "Receive this account’s reblogs in home timeline?",
                            example: true,
                        }),
                        notify: z.boolean().default(false).openapi({
                            description:
                                "Receive notifications when this account posts a status?",
                            example: false,
                        }),
                        languages: z
                            .array(iso631)
                            .default([])
                            .openapi({
                                description:
                                    "Array of String (ISO 639-1 language two-letter code). Filter received statuses for these languages. If not provided, you will receive this account’s posts in all languages.",
                                example: ["en", "fr"],
                            }),
                    }),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
        const { reblogs, notify, languages } = context.req.valid("json");
        const otherUser = context.get("user");

        let relationship = await Relationship.fromOwnerAndSubject(
            user,
            otherUser,
        );

        if (!relationship.data.following) {
            relationship = await user.followRequest(otherUser, {
                reblogs,
                notify,
                languages,
            });
        }

        return context.json(relationship.toApi(), 200);
    }),
);
