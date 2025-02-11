import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Emoji } from "@versia/kit/db";
import { Emojis, RolePermissions } from "@versia/kit/tables";
import { and, eq, isNull, or } from "drizzle-orm";
import { CustomEmoji } from "~/classes/schemas/emoji";

const route = createRoute({
    method: "get",
    path: "/api/v1/custom_emojis",
    summary: "Get custom emojis",
    description: "Get custom emojis",
    middleware: [
        auth({
            auth: false,
            permissions: [RolePermissions.ViewEmojis],
        }),
    ] as const,
    responses: {
        200: {
            description: "Emojis",
            content: {
                "application/json": {
                    schema: z.array(CustomEmoji),
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
