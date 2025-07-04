import { RolePermission, Status as StatusSchema } from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import {
    apiRoute,
    auth,
    handleZodError,
    withNoteParam,
} from "@versia-server/kit/api";
import { Emoji } from "@versia-server/kit/db";
import { Emojis } from "@versia-server/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import emojis from "unicode-emoji-json/data-ordered-emoji.json" with {
    type: "json",
};
import { z } from "zod";

export default apiRoute((app) => {
    app.put(
        "/api/v1/statuses/:id/reactions/:name",
        describeRoute({
            summary: "Add reaction to status",
            description: "Add a reaction to a note.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#reaction-add",
            },
            tags: ["Statuses"],
            responses: {
                201: {
                    description: "Reaction added successfully",
                    content: {
                        "application/json": {
                            schema: resolver(StatusSchema),
                        },
                    },
                },
                404: ApiError.noteNotFound().schema,
                401: ApiError.missingAuthentication().schema,
                422: {
                    description: "Invalid emoji or already reacted",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
            },
        }),
        auth({
            auth: true,
            permissions: [
                RolePermission.ManageOwnReactions,
                RolePermission.ViewNotes,
            ],
        }),
        withNoteParam,
        validator(
            "param",
            z.object({ name: z.string().min(1) }),
            handleZodError,
        ),
        async (context) => {
            const { user } = context.get("auth");
            const note = context.get("note");
            const emojiName = context.req.param("name");

            if (!emojiName) {
                throw new ApiError(
                    422,
                    "Missing emoji name",
                    "Emoji name is required in the URL path",
                );
            }

            // Determine if this is a custom emoji or Unicode emoji
            let emoji: Emoji | string;

            if (emojiName.startsWith(":") && emojiName.endsWith(":")) {
                // Custom emoji - find the emoji by shortcode
                const shortcode = emojiName.slice(1, -1);
                const foundCustomEmoji = await Emoji.fromSql(
                    and(
                        eq(Emojis.shortcode, shortcode),
                        isNull(Emojis.instanceId), // Only local emojis for now
                    ),
                );

                if (!foundCustomEmoji) {
                    throw new ApiError(
                        422,
                        "Custom emoji not found",
                        `The custom emoji :${shortcode}: was not found`,
                    );
                }

                emoji = foundCustomEmoji;
            } else {
                // Unicode emoji - check if it's valid
                const unicodeEmoji = emojis.find((e) => e === emojiName);

                if (!unicodeEmoji) {
                    throw new ApiError(
                        422,
                        "Invalid emoji",
                        `The emoji "${emojiName}" is not a valid Unicode emoji or custom emoji`,
                    );
                }

                emoji = unicodeEmoji;
            }

            await note.react(user, emoji);

            // Reload note to get updated reactions
            await note.reload(user.id);

            return context.json(await note.toApi(user), 201);
        },
    );

    app.delete(
        "/api/v1/statuses/:id/reactions/:name",
        describeRoute({
            summary: "Remove reaction from status",
            description: "Remove a reaction from a note.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#reaction-remove",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description: "Reaction removed or was not present",
                    content: {
                        "application/json": {
                            schema: resolver(StatusSchema),
                        },
                    },
                },
                404: ApiError.noteNotFound().schema,
                401: ApiError.missingAuthentication().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [
                RolePermission.ManageOwnReactions,
                RolePermission.ViewNotes,
            ],
        }),
        withNoteParam,
        validator(
            "param",
            z.object({ name: z.string().min(1) }),
            handleZodError,
        ),
        async (context) => {
            const { user } = context.get("auth");
            const note = context.get("note");
            const emojiName = context.req.param("name");

            if (!emojiName) {
                throw new ApiError(
                    422,
                    "Missing emoji name",
                    "Emoji name is required in the URL path",
                );
            }

            // Determine if this is a custom emoji or Unicode emoji
            let emoji: Emoji | string;

            if (emojiName.startsWith(":") && emojiName.endsWith(":")) {
                // Custom emoji - find the emoji by shortcode
                const shortcode = emojiName.slice(1, -1);
                const foundCustomEmoji = await Emoji.fromSql(
                    and(
                        eq(Emojis.shortcode, shortcode),
                        isNull(Emojis.instanceId),
                    ),
                );

                if (!foundCustomEmoji) {
                    throw new ApiError(
                        422,
                        "Custom emoji not found",
                        `The custom emoji :${shortcode}: was not found`,
                    );
                }

                emoji = foundCustomEmoji;
            } else {
                // Unicode emoji - check if it's valid
                const unicodeEmoji = emojis.find((e) => e === emojiName);

                if (!unicodeEmoji) {
                    throw new ApiError(
                        422,
                        "Invalid emoji",
                        `The emoji "${emojiName}" is not a valid Unicode emoji or custom emoji`,
                    );
                }

                emoji = unicodeEmoji;
            }

            await note.unreact(user, emoji);

            // Reload note to get updated reactions
            await note.reload(user.id);

            return context.json(await note.toApi(user), 200);
        },
    );
});
