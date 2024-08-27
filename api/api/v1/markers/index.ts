import {
    apiRoute,
    applyConfig,
    auth,
    handleZodError,
    idValidator,
} from "@/api";
import { zValidator } from "@hono/zod-validator";
import type { Marker as ApiMarker } from "@versia/client/types";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { Markers, RolePermissions } from "~/drizzle/schema";

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
    permissions: {
        required: [RolePermissions.ManageOwnAccount],
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

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { "timeline[]": timelines } = context.req.valid("query");
            const { user } = context.get("auth");

            const timeline = Array.isArray(timelines) ? timelines : [];

            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            switch (context.req.method) {
                case "GET": {
                    if (!timeline) {
                        return context.json({});
                    }

                    const markers: ApiMarker = {
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

                    return context.json(markers);
                }

                case "POST": {
                    const {
                        "home[last_read_id]": homeId,
                        "notifications[last_read_id]": notificationsId,
                    } = context.req.valid("query");

                    const markers: ApiMarker = {
                        home: undefined,
                        notifications: undefined,
                    };

                    if (homeId) {
                        const insertedMarker = (
                            await db
                                .insert(Markers)
                                .values({
                                    userId: user.id,
                                    timeline: "home",
                                    noteId: homeId,
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
                            last_read_id: homeId,
                            version: totalCount[0].count,
                            updated_at: new Date(
                                insertedMarker.createdAt,
                            ).toISOString(),
                        };
                    }

                    if (notificationsId) {
                        const insertedMarker = (
                            await db
                                .insert(Markers)
                                .values({
                                    userId: user.id,
                                    timeline: "notifications",
                                    notificationId: notificationsId,
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
                            last_read_id: notificationsId,
                            version: totalCount[0].count,
                            updated_at: new Date(
                                insertedMarker.createdAt,
                            ).toISOString(),
                        };
                    }

                    return context.json(markers);
                }
            }
        },
    ),
);
