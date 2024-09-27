import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { and, eq, isNull, or } from "drizzle-orm";
import { Emojis, RolePermissions } from "~/drizzle/schema";
import { Emoji } from "~/packages/database-interface/emoji";

export const meta = applyConfig({
    route: "/api/v1/custom_emojis",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: false,
    },
    permissions: {
        required: [RolePermissions.ViewEmojis],
    },
});

const route = createRoute({
    method: "get",
    path: "/api/v1/custom_emojis",
    summary: "Get custom emojis",
    description: "Get custom emojis",
    middleware: [auth(meta.auth, meta.permissions)],
    responses: {
        200: {
            description: "Emojis",
            content: {
                "application/json": {
                    schema: z.array(Emoji.schema),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");

        const emojis = await Emoji.manyFromSql(
            and(
                isNull(Emojis.instanceId),
                or(
                    isNull(Emojis.ownerId),
                    user ? eq(Emojis.ownerId, user.id) : undefined,
                ),
            ),
        );

        return context.json(
            emojis.map((emoji) => emoji.toApi()),
            200,
        );
    }),
);
