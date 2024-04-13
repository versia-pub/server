import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";
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

export default apiRoute(async () => {
    const emojis = await db.query.emoji.findMany({
        where: (emoji, { isNull }) => isNull(emoji.instanceId),
        with: {
            instance: true,
        },
    });

    return jsonResponse(
        await Promise.all(emojis.map((emoji) => emojiToAPI(emoji))),
    );
});
