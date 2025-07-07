import {
    CustomEmoji as CustomEmojiSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth } from "@versia-server/kit/api";
import { Emoji } from "@versia-server/kit/db";
import { Emojis } from "@versia-server/kit/tables";
import { and, eq, isNull, or } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod/v4";

export default apiRoute((app) =>
    app.get(
        "/api/v1/custom_emojis",
        describeRoute({
            summary: "View all custom emoji",
            description:
                "Returns custom emojis that are available on the server.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/custom_emojis/#get",
            },
            tags: ["Emojis"],
            responses: {
                200: {
                    description: "List of custom emojis",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(CustomEmojiSchema)),
                        },
                    },
                },
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: false,
            permissions: [RolePermission.ViewEmojis],
        }),
        async (context) => {
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
        },
    ),
);
