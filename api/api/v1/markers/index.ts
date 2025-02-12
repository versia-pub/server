import { apiRoute, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { db } from "@versia/kit/db";
import { Markers, RolePermissions } from "@versia/kit/tables";
import { type SQL, and, eq } from "drizzle-orm";
import { Marker as MarkerSchema } from "~/classes/schemas/marker";
import { Notification as NotificationSchema } from "~/classes/schemas/notification";
import { Status as StatusSchema } from "~/classes/schemas/status";

const MarkerResponseSchema = z.object({
    notifications: MarkerSchema.optional(),
    home: MarkerSchema.optional(),
});

const routeGet = createRoute({
    method: "get",
    path: "/api/v1/markers",
    summary: "Get markers",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnAccount],
        }),
    ] as const,
    request: {
        query: z.object({
            "timeline[]": z
                .array(z.enum(["home", "notifications"]))
                .max(2)
                .or(z.enum(["home", "notifications"]))
                .optional(),
        }),
    },
    responses: {
        200: {
            description: "Markers",
            content: {
                "application/json": {
                    schema: MarkerResponseSchema,
                },
            },
        },
    },
});

const routePost = createRoute({
    method: "post",
    path: "/api/v1/markers",
    summary: "Update markers",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnAccount],
        }),
    ] as const,
    request: {
        query: z.object({
            "home[last_read_id]": StatusSchema.shape.id.optional(),
            "notifications[last_read_id]":
                NotificationSchema.shape.id.optional(),
        }),
    },
    responses: {
        200: {
            description: "Markers",
            content: {
                "application/json": {
                    schema: MarkerResponseSchema,
                },
            },
        },
    },
});

export default apiRoute((app) => {
    app.openapi(routeGet, async (context) => {
        const { "timeline[]": timelines } = context.req.valid("query");
        const { user } = context.get("auth");

        const timeline = Array.isArray(timelines) ? timelines : [];

        if (!timeline) {
            return context.json({}, 200);
        }

        const markers: z.infer<typeof MarkerResponseSchema> = {
            home: undefined,
            notifications: undefined,
        };

        if (timeline.includes("home")) {
            const found = await db.query.Markers.findFirst({
                where: (marker, { and, eq }): SQL | undefined =>
                    and(
                        eq(marker.userId, user.id),
                        eq(marker.timeline, "home"),
                    ),
            });

            const totalCount = await db.$count(
                Markers,
                and(eq(Markers.userId, user.id), eq(Markers.timeline, "home")),
            );

            if (found?.noteId) {
                markers.home = {
                    last_read_id: found.noteId,
                    version: totalCount,
                    updated_at: new Date(found.createdAt).toISOString(),
                };
            }
        }

        if (timeline.includes("notifications")) {
            const found = await db.query.Markers.findFirst({
                where: (marker, { and, eq }): SQL | undefined =>
                    and(
                        eq(marker.userId, user.id),
                        eq(marker.timeline, "notifications"),
                    ),
            });

            const totalCount = await db.$count(
                Markers,
                and(
                    eq(Markers.userId, user.id),
                    eq(Markers.timeline, "notifications"),
                ),
            );

            if (found?.notificationId) {
                markers.notifications = {
                    last_read_id: found.notificationId,
                    version: totalCount,
                    updated_at: new Date(found.createdAt).toISOString(),
                };
            }
        }

        return context.json(markers, 200);
    });

    app.openapi(routePost, async (context) => {
        const {
            "home[last_read_id]": homeId,
            "notifications[last_read_id]": notificationsId,
        } = context.req.valid("query");
        const { user } = context.get("auth");

        const markers: z.infer<typeof MarkerResponseSchema> = {
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

            const totalCount = await db.$count(
                Markers,
                and(eq(Markers.userId, user.id), eq(Markers.timeline, "home")),
            );

            markers.home = {
                last_read_id: homeId,
                version: totalCount,
                updated_at: new Date(insertedMarker.createdAt).toISOString(),
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

            const totalCount = await db.$count(
                Markers,
                and(
                    eq(Markers.userId, user.id),
                    eq(Markers.timeline, "notifications"),
                ),
            );

            markers.notifications = {
                last_read_id: notificationsId,
                version: totalCount,
                updated_at: new Date(insertedMarker.createdAt).toISOString(),
            };
        }

        return context.json(markers, 200);
    });
});
