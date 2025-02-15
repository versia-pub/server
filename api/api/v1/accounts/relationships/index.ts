import { apiRoute, auth, qsQuery, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { Account as AccountSchema } from "~/classes/schemas/account";
import { zBoolean } from "~/classes/schemas/common.ts";
import { Relationship as RelationshipSchema } from "~/classes/schemas/relationship";

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/relationships",
    summary: "Check relationships to other accounts",
    description:
        "Find out whether a given account is followed, blocked, muted, etc.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#relationships",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            scopes: ["read:follows"],
            permissions: [RolePermissions.ManageOwnFollows],
        }),
        qsQuery(),
    ] as const,
    request: {
        query: z.object({
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
    },
    responses: {
        200: {
            description: "Relationships",
            content: {
                "application/json": {
                    schema: z.array(RelationshipSchema),
                },
            },
        },
        ...reusedResponses,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");

        // TODO: Implement with_suspended
        const { id } = context.req.valid("query");

        const ids = Array.isArray(id) ? id : [id];

        const relationships = await Relationship.fromOwnerAndSubjects(
            user,
            ids,
        );

        relationships.sort(
            (a, b) =>
                ids.indexOf(a.data.subjectId) - ids.indexOf(b.data.subjectId),
        );

        return context.json(
            relationships.map((r) => r.toApi()),
            200,
        );
    }),
);
