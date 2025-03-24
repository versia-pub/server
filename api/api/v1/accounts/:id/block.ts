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
    path: "/api/v1/accounts/{id}/block",
    summary: "Block account",
    description:
        "Block the given account. Clients should filter statuses from this account if received (e.g. due to a boost in the Home timeline)",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#block",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            scopes: ["write:blocks"],
            permissions: [
                RolePermission.ManageOwnBlocks,
                RolePermission.ViewAccounts,
            ],
        }),
        withUserParam,
    ] as const,
    responses: {
        200: {
            description:
                "Successfully blocked, or account was already blocked.",
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
    request: {
        params: z.object({
            id: AccountSchema.shape.id,
        }),
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
        const otherUser = context.get("user");

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            user,
            otherUser,
        );

        if (!foundRelationship.data.blocking) {
            await foundRelationship.update({
                blocking: true,
            });
        }

        return context.json(foundRelationship.toApi(), 200);
    }),
);
