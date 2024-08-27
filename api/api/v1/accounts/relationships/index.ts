import { apiRoute, applyConfig, auth, qsQuery } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { Relationship } from "~/packages/database-interface/relationship";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/accounts/relationships",
    ratelimits: {
        max: 30,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:follows"],
    },
    permissions: {
        required: [RolePermissions.ManageOwnFollows],
    },
});

export const schemas = {
    query: z.object({
        id: z.array(z.string().uuid()).min(1).max(10).or(z.string().uuid()),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/relationships",
    summary: "Get relationships",
    description: "Get relationships by account ID",
    middleware: [auth(meta.auth, meta.permissions), qsQuery()],
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
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user: self } = context.get("auth");
        const { id } = context.req.valid("query");

        const ids = Array.isArray(id) ? id : [id];

        if (!self) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const relationships = await Relationship.fromOwnerAndSubjects(
            self,
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
