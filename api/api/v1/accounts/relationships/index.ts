import { apiRoute, auth, qsQuery } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Relationship } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";

const schemas = {
    query: z.object({
        id: z.array(z.string().uuid()).min(1).max(10).or(z.string().uuid()),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/relationships",
    summary: "Get relationships",
    description: "Get relationships by account ID",
    middleware: [
        auth({
            auth: true,
            scopes: ["read:follows"],
            permissions: [RolePermissions.ManageOwnFollows],
        }),
        qsQuery(),
    ] as const,
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Relationships",
            content: {
                "application/json": {
                    schema: z.array(Relationship.schema),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
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
