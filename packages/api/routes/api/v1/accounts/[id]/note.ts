import {
    Relationship as RelationshipSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { apiRoute, auth, handleZodError, withUserParam } from "@versia/kit/api";
import { Relationship } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";

export default apiRoute((app) =>
    app.post(
        "/api/v1/accounts/:id/note",
        describeRoute({
            summary: "Set private note on profile",
            description: "Sets a private note on a user.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#note",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description: "Successfully updated profile note",
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
            scopes: ["write:accounts"],
            permissions: [
                RolePermission.ManageOwnAccount,
                RolePermission.ViewAccounts,
            ],
        }),
        validator(
            "json",
            z.object({
                comment: RelationshipSchema.shape.note.optional().openapi({
                    description:
                        "The comment to be set on that user. Provide an empty string or leave out this parameter to clear the currently set note.",
                }),
            }),
            handleZodError,
        ),
        async (context) => {
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
        },
    ),
);
