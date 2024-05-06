import { applyConfig } from "@api";
import { jsonResponse } from "@response";
import type { Hono } from "hono";
import { emojiToAPI } from "~database/entities/Emoji";
import { db } from "~drizzle/db";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/custom_emojis",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: false,
    },
});

export default (app: Hono) =>
    app.on(meta.allowedMethods, meta.route, async () => {
        const emojis = await db.query.Emojis.findMany({
            where: (emoji, { isNull }) => isNull(emoji.instanceId),
            with: {
                instance: true,
            },
        });

        return jsonResponse(
            await Promise.all(emojis.map((emoji) => emojiToAPI(emoji))),
        );
    });
