import {
    iso631,
    Relationship as RelationshipSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import {
    apiRoute,
    auth,
    handleZodError,
    withUserParam,
} from "@versia-server/kit/api";
import { Relationship } from "@versia-server/kit/db";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.post(
        "/api/v1/accounts/:id/follow",
        describeRoute({
            summary: "Follow account",
            description:
                "Follow the given account. Can also be used to update whether to show reblogs or enable notifications.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#follow",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description:
                        "Successfully followed, or account was already followed",
                    content: {
                        "application/json": {
                            schema: resolver(RelationshipSchema),
                        },
                    },
                },
                403: {
                    description:
                        "Trying to follow someone that you block or that blocks you",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
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
            scopes: ["write:follows"],
            permissions: [
                RolePermission.ManageOwnFollows,
                RolePermission.ViewAccounts,
            ],
        }),
        validator(
            "json",
            z.object({
                reblogs: z.boolean().default(true).meta({
                    description:
                        "Receive this account’s reblogs in home timeline?",
                    example: true,
                }),
                notify: z.boolean().default(false).meta({
                    description:
                        "Receive notifications when this account posts a status?",
                    example: false,
                }),
                languages: z
                    .array(iso631)
                    .default([])
                    .meta({
                        description:
                            "Array of String (ISO 639-1 language two-letter code). Filter received statuses for these languages. If not provided, you will receive this account’s posts in all languages.",
                        example: ["en", "fr"],
                    }),
            }),
            handleZodError,
        ),
        async (context) => {
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
        },
    ),
);
