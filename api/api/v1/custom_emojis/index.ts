import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Emoji } from "@versia/kit/db";
import { Emojis, RolePermissions } from "@versia/kit/tables";
import { and, eq, isNull, or } from "drizzle-orm";
import { CustomEmoji as CustomEmojiSchema } from "~/classes/schemas/emoji";

const route = createRoute({
    method: "get",
    path: "/api/v1/custom_emojis",
    summary: "View all custom emoji",
    description: "Returns custom emojis that are available on the server.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/custom_emojis/#get",
    },
    tags: ["Emojis"],
    middleware: [
        auth({
            auth: false,
            permissions: [RolePermissions.ViewEmojis],
        }),
    ] as const,
    responses: {
        200: {
            description: "List of custom emojis",
            content: {
                "application/json": {
                    schema: z.array(CustomEmojiSchema),
                },
            },
        },
        422: reusedResponses[422],
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
