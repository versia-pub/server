import {
    Account as AccountSchema,
    FamiliarFollowers as FamiliarFollowersSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { apiRoute, auth, handleZodError, qsQuery } from "@versia/kit/api";
import { db, User } from "@versia/kit/db";
import type { Users } from "@versia/kit/tables";
import { type InferSelectModel, sql } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { rateLimit } from "../../../../../middlewares/rate-limit.ts";

export default apiRoute((app) =>
    app.get(
        "/api/v1/accounts/familiar_followers",
        describeRoute({
            summary: "Get familiar followers",
            description:
                "Obtain a list of all accounts that follow a given account, filtered for accounts you follow.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/accounts/#familiar_followers",
            },
            tags: ["Accounts"],
            responses: {
                200: {
                    description: "Familiar followers",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(FamiliarFollowersSchema)),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        qsQuery(),
        auth({
            auth: true,
            scopes: ["read:follows"],
            permissions: [RolePermission.ManageOwnFollows],
        }),
        rateLimit(5),
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
                            "Find familiar followers for the provided account IDs.",
                        example: [
                            "f137ce6f-ff5e-4998-b20f-0361ba9be007",
                            "8424c654-5d03-4a1b-bec8-4e87db811b5d",
                        ],
                    }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { user } = context.get("auth");
            const { id: ids } = context.req.valid("query");

            // Find followers of the accounts in "ids", that you also follow
            const finalUsers = await Promise.all(
                ids.map(async (id) => ({
                    id,
                    accounts: await User.fromIds(
                        (
                            await db.execute(sql<
                                InferSelectModel<typeof Users>
                            >`
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
                        ).map((u) => u.id as string),
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
        },
    ),
);
