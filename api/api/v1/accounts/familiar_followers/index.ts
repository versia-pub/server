import { apiRoute, auth, qsQuery } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { User, db } from "@versia/kit/db";
import { RolePermissions, type Users } from "@versia/kit/tables";
import { type InferSelectModel, sql } from "drizzle-orm";
import { z } from "zod";

const schemas = {
    query: z.object({
        id: z
            .array(z.string().uuid())
            .min(1)
            .max(10)
            .or(z.string().uuid())
            .transform((v) => (Array.isArray(v) ? v : [v])),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/familiar_followers",
    summary: "Get familiar followers",
    description:
        "Obtain a list of all accounts that follow a given account, filtered for accounts you follow.",
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
            description: "Familiar followers",
            content: {
                "application/json": {
                    schema: z.array(
                        z.object({
                            id: z.string().uuid(),
                            accounts: z.array(User.schema),
                        }),
                    ),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");
        const { id: ids } = context.req.valid("query");

        // Find followers of the accounts in "ids", that you also follow
        const finalUsers = await Promise.all(
            ids.map(async (id) => ({
                id,
                accounts: await User.fromIds(
                    (
                        await db.execute(sql<InferSelectModel<typeof Users>>`
                        SELECT "Users"."id" FROM "Users"
                        INNER JOIN "Relationships" AS "SelfFollowing"
                            ON "SelfFollowing"."subjectId" = "Users"."id"
                        WHERE "SelfFollowing"."ownerId" = ${user.id}
                            AND "SelfFollowing"."following" = true
                            AND EXISTS (
                                SELECT 1 FROM "Relationships" AS "IdsFollowers"
                                WHERE "IdsFollowers"."subjectId" = ${id}
                                    AND "IdsFollowers"."ownerId" = "Users"."id"
                                    AND "IdsFollowers"."following" = true
                            )
                    `)
                    ).rows.map((u) => u.id as string),
                ),
            })),
        );

        return context.json(
            finalUsers.map((u) => ({
                ...u,
                accounts: u.accounts.map((a) => a.toApi()),
            })),
            200,
        );
    }),
);
