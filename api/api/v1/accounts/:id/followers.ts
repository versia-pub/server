import { apiRoute, applyConfig, auth, idValidator } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Timeline, User } from "@versia/kit/db";
import { and, gt, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { RolePermissions, Users } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 60,
        duration: 60,
    },
    route: "/api/v1/accounts/:id/followers",
    auth: {
        required: false,
        oauthPermissions: ["read:accounts"],
    },
    permissions: {
        required: [
            RolePermissions.ViewAccountFollows,
            RolePermissions.ViewAccounts,
        ],
    },
});

export const schemas = {
    query: z.object({
        max_id: z.string().regex(idValidator).optional(),
        since_id: z.string().regex(idValidator).optional(),
        min_id: z.string().regex(idValidator).optional(),
        limit: z.coerce.number().int().min(1).max(40).optional().default(20),
    }),
    param: z.object({
        id: z.string().uuid(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/{id}/followers",
    summary: "Get account followers",
    description:
        "Gets an paginated list of accounts that follow the specified account",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
        query: schemas.query,
    },
    responses: {
        200: {
            description: "A list of accounts that follow the specified account",
            content: {
                "application/json": {
                    schema: z.array(User.schema),
                },
            },
            headers: {
                Link: {
                    description: "Links to the next and previous pages",
                },
            },
        },
        404: {
            description: "The specified account was not found",
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
        const { id } = context.req.valid("param");
        const { max_id, since_id, min_id, limit } = context.req.valid("query");

        const otherUser = await User.fromId(id);

        // TODO: Add follower/following privacy settings

        if (!otherUser) {
            return context.json({ error: "User not found" }, 404);
        }

        const { objects, link } = await Timeline.getUserTimeline(
            and(
                max_id ? lt(Users.id, max_id) : undefined,
                since_id ? gte(Users.id, since_id) : undefined,
                min_id ? gt(Users.id, min_id) : undefined,
                sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${otherUser.id} AND "Relationships"."ownerId" = ${Users.id} AND "Relationships"."following" = true)`,
            ),
            limit,
            context.req.url,
        );

        return context.json(
            await Promise.all(objects.map((object) => object.toApi())),
            200,
            {
                Link: link,
            },
        );
    }),
);
