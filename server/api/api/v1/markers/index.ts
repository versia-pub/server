import {
    applyConfig,
    auth,
    handleZodError,
    idValidator,
    qs,
    qsQuery,
} from "@api";
import { zValidator } from "@hono/zod-validator";
import { errorResponse, jsonResponse } from "@response";
import { and, count, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import { db } from "~drizzle/db";
import { Markers } from "~drizzle/schema";
import type { Marker as APIMarker } from "~types/mastodon/marker";

export const meta = applyConfig({
    allowedMethods: ["GET", "POST"],
    route: "/api/v1/markers",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:blocks"],
    },
});

export const schemas = {
    query: z.object({
        "timeline[]": z
            .array(z.enum(["home", "notifications"]))
            .max(2)
            .or(z.enum(["home", "notifications"]))
            .optional(),
        "home[last_read_id]": z.string().regex(idValidator).optional(),
        "notifications[last_read_id]": z.string().regex(idValidator).optional(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth),
        async (context) => {
            const { "timeline[]": timelines } = context.req.valid("query");
            const { user } = context.req.valid("header");

            const timeline = Array.isArray(timelines) ? timelines : [];

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            switch (context.req.method) {
                case "GET": {
                    if (!timeline) {
                        return jsonResponse({});
                    }

                    const markers: APIMarker = {
                        home: undefined,
                        notifications: undefined,
                    };

                    if (timeline.includes("home")) {
                        const found = await db.query.Markers.findFirst({
                            where: (marker, { and, eq }) =>
                                and(
                                    eq(marker.userId, user.id),
                                    eq(marker.timeline, "home"),
                                ),
                        });

                        const totalCount = await db
                            .select({
                                count: count(),
                            })
                            .from(Markers)
                            .where(
                                and(
                                    eq(Markers.userId, user.id),
                                    eq(Markers.timeline, "home"),
                                ),
                            );

                        if (found?.noteId) {
                            markers.home = {
                                last_read_id: found.noteId,
                                version: totalCount[0].count,
                                updated_at: new Date(
                                    found.createdAt,
                                ).toISOString(),
                            };
                        }
                    }

                    if (timeline.includes("notifications")) {
                        const found = await db.query.Markers.findFirst({
                            where: (marker, { and, eq }) =>
                                and(
                                    eq(marker.userId, user.id),
                                    eq(marker.timeline, "notifications"),
                                ),
                        });

                        const totalCount = await db
                            .select({
                                count: count(),
                            })
                            .from(Markers)
                            .where(
                                and(
                                    eq(Markers.userId, user.id),
                                    eq(Markers.timeline, "notifications"),
                                ),
                            );

                        if (found?.notificationId) {
                            markers.notifications = {
                                last_read_id: found.notificationId,
                                version: totalCount[0].count,
                                updated_at: new Date(
                                    found.createdAt,
                                ).toISOString(),
                            };
                        }
                    }

                    return jsonResponse(markers);
                }

                case "POST": {
                    const {
                        "home[last_read_id]": home_id,
                        "notifications[last_read_id]": notifications_id,
                    } = context.req.valid("query");

                    const markers: APIMarker = {
                        home: undefined,
                        notifications: undefined,
                    };

                    if (home_id) {
                        const insertedMarker = (
                            await db
                                .insert(Markers)
                                .values({
                                    userId: user.id,
                                    timeline: "home",
                                    noteId: home_id,
                                })
                                .returning()
                        )[0];

                        const totalCount = await db
                            .select({
                                count: count(),
                            })
                            .from(Markers)
                            .where(
                                and(
                                    eq(Markers.userId, user.id),
                                    eq(Markers.timeline, "home"),
                                ),
                            );

                        markers.home = {
                            last_read_id: home_id,
                            version: totalCount[0].count,
                            updated_at: new Date(
                                insertedMarker.createdAt,
                            ).toISOString(),
                        };
                    }

                    if (notifications_id) {
                        const insertedMarker = (
                            await db
                                .insert(Markers)
                                .values({
                                    userId: user.id,
                                    timeline: "notifications",
                                    notificationId: notifications_id,
                                })
                                .returning()
                        )[0];

                        const totalCount = await db
                            .select({
                                count: count(),
                            })
                            .from(Markers)
                            .where(
                                and(
                                    eq(Markers.userId, user.id),
                                    eq(Markers.timeline, "notifications"),
                                ),
                            );

                        markers.notifications = {
                            last_read_id: notifications_id,
                            version: totalCount[0].count,
                            updated_at: new Date(
                                insertedMarker.createdAt,
                            ).toISOString(),
                        };
                    }

                    return jsonResponse(markers);
                }
            }
        },
    );
