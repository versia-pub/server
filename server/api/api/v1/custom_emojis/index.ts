import { applyConfig, auth } from "@/api";
import { jsonResponse } from "@/response";
import type { Hono } from "hono";
import { emojiToApi } from "~/database/entities/emoji";
import { db } from "~/drizzle/db";
import { RolePermissions } from "~/drizzle/schema";

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
    permissions: {
        required: [RolePermissions.ViewEmojis],
    },
});

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user } = context.req.valid("header");

            const emojis = await db.query.Emojis.findMany({
                where: (emoji, { isNull, and, eq, or }) =>
                    and(
                        isNull(emoji.instanceId),
                        or(
                            isNull(emoji.ownerId),
                            user ? eq(emoji.ownerId, user.id) : undefined,
                        ),
                    ),
                with: {
                    instance: true,
                },
            });

            return jsonResponse(
                await Promise.all(emojis.map((emoji) => emojiToApi(emoji))),
            );
        },
    );
