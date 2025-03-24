import { apiRoute, auth, withUserParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Account as AccountSchema,
    Relationship as RelationshipSchema,
} from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Relationship } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "post",
    path: "/api/v1/accounts/{id}/note",
    summary: "Set private note on profile",
    description: "Sets a private note on a user.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#note",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:accounts"],
            permissions: [
                RolePermission.ManageOwnAccount,
                RolePermission.ViewAccounts,
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
                        comment: RelationshipSchema.shape.note
                            .optional()
                            .openapi({
                                description:
                                    "The comment to be set on that user. Provide an empty string or leave out this parameter to clear the currently set note.",
                            }),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: "Successfully updated profile note",
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
        const { comment } = context.req.valid("json");
        const otherUser = context.get("user");

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            user,
            otherUser,
        );

        await foundRelationship.update({
            note: comment ?? "",
        });

        return context.json(foundRelationship.toApi(), 200);
    }),
);
