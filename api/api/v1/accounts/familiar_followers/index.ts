import { apiRoute, applyConfig, auth, qsQuery } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { RolePermissions, Users } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    route: "/api/v1/accounts/familiar_followers",
    ratelimits: {
        max: 5,
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
    path: "/api/v1/accounts/familiar_followers",
    summary: "Get familiar followers",
    description:
        "Obtain a list of all accounts that follow a given account, filtered for accounts you follow.",
    middleware: [auth(meta.auth, meta.permissions), qsQuery()],
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Familiar followers",
            content: {
                "application/json": {
                    schema: z.array(User.schema),
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
        const { id: ids } = context.req.valid("query");

        if (!self) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const idFollowerRelationships = await db.query.Relationships.findMany({
            columns: {
                ownerId: true,
            },
            where: (relationship, { inArray, and, eq }) =>
                and(
                    inArray(
                        relationship.subjectId,
                        Array.isArray(ids) ? ids : [ids],
                    ),
                    eq(relationship.following, true),
                ),
        });

        if (idFollowerRelationships.length === 0) {
            return context.json([], 200);
        }

        // Find users that you follow in idFollowerRelationships
        const relevantRelationships = await db.query.Relationships.findMany({
            columns: {
                subjectId: true,
            },
            where: (relationship, { inArray, and, eq }) =>
                and(
                    eq(relationship.ownerId, self.id),
                    inArray(
                        relationship.subjectId,
                        idFollowerRelationships.map((f) => f.ownerId),
                    ),
                    eq(relationship.following, true),
                ),
        });

        if (relevantRelationships.length === 0) {
            return context.json([], 200);
        }

        const finalUsers = await User.manyFromSql(
            inArray(
                Users.id,
                relevantRelationships.map((r) => r.subjectId),
            ),
        );

        return context.json(
            finalUsers.map((o) => o.toApi()),
            200,
        );
    }),
);
