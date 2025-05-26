import {
    Account as AccountSchema,
    Relationship as RelationshipSchema,
    RolePermission,
    zBoolean,
} from "@versia/client/schemas";
import { Relationship } from "@versia/kit/db";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { apiRoute, auth, handleZodError, qsQuery } from "@/api";
import { ApiError } from "~/classes/errors/api-error";
import { rateLimit } from "~/middlewares/rate-limit";

export default apiRoute((app) =>
    app.get(
        "/api/v1/accounts/relationships",
        describeRoute({
            summary: "Check relationships to other accounts",
            description:
                "Find out whether a given account is followed, blocked, muted, etc.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#relationships",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description: "Relationships",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(RelationshipSchema)),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        rateLimit(10),
        auth({
            auth: true,
            scopes: ["read:follows"],
            permissions: [RolePermission.ManageOwnFollows],
        }),
        qsQuery(),
        validator(
            "query",
            z.object({
                id: z
                    .array(AccountSchema.shape.id)
                    .min(1)
                    .max(10)
                    .or(AccountSchema.shape.id.transform((v) => [v]))
                    .openapi({
                        description:
                            "Check relationships for the provided account IDs.",
                        example: [
                            "f137ce6f-ff5e-4998-b20f-0361ba9be007",
                            "8424c654-5d03-4a1b-bec8-4e87db811b5d",
                        ],
                    }),
                with_suspended: zBoolean.default(false).openapi({
                    description:
                        "Whether relationships should be returned for suspended users",
                    example: false,
                }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { user } = context.get("auth");

            // TODO: Implement with_suspended
            const { id: ids } = context.req.valid("query");

            const relationships = await Relationship.fromOwnerAndSubjects(
                user,
                ids,
            );

            relationships.sort(
                (a, b) =>
                    ids.indexOf(a.data.subjectId) -
                    ids.indexOf(b.data.subjectId),
            );

            return context.json(
                relationships.map((r) => r.toApi()),
                200,
            );
        },
    ),
);
