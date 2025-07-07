import {
    Account as AccountSchema,
    Relationship as RelationshipSchema,
    RolePermission,
    zBoolean,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import {
    apiRoute,
    auth,
    handleZodError,
    qsQuery,
} from "@versia-server/kit/api";
import { Relationship } from "@versia-server/kit/db";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";
import { rateLimit } from "../../../../../middlewares/rate-limit.ts";

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
                    .or(AccountSchema.shape.id)
                    .meta({
                        description:
                            "Check relationships for the provided account IDs.",
                        example: [
                            "f137ce6f-ff5e-4998-b20f-0361ba9be007",
                            "8424c654-5d03-4a1b-bec8-4e87db811b5d",
                        ],
                    }),
                with_suspended: zBoolean.default(false).meta({
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
            const { id } = context.req.valid("query");

            const relationships = await Relationship.fromOwnerAndSubjects(
                user,
                Array.isArray(id) ? id : [id],
            );

            relationships.sort(
                (a, b) =>
                    id.indexOf(a.data.subjectId) - id.indexOf(b.data.subjectId),
            );

            return context.json(
                relationships.map((r) => r.toApi()),
                200,
            );
        },
    ),
);
