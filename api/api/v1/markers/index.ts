import { apiRoute, applyConfig, auth, idValidator } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import type { Marker as ApiMarker } from "@versia/client/types";
import { db } from "@versia/kit/db";
import { Markers, RolePermissions } from "@versia/kit/tables";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
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
    markers: z.object({
        home: z
            .object({
                last_read_id: z.string().regex(idValidator),
                version: z.number(),
                updated_at: z.string(),
            })
            .nullable()
            .optional(),
        notifications: z
            .object({
                last_read_id: z.string().regex(idValidator),
                version: z.number(),
                updated_at: z.string(),
            })
            .nullable()
            .optional(),
    }),
};

const routeGet = createRoute({
    method: "get",
    path: "/api/v1/markers",
    summary: "Get markers",
    middleware: [auth(meta.auth, meta.permissions)],
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
                    schema: schemas.markers,
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

const routePost = createRoute({
    method: "post",
    path: "/api/v1/markers",
    summary: "Update markers",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        query: z.object({
            "home[last_read_id]": z.string().regex(idValidator).optional(),
            "notifications[last_read_id]": z
                .string()
                .regex(idValidator)
                .optional(),
        }),
    },
    responses: {
        200: {
            description: "Markers",
            content: {
                "application/json": {
                    schema: schemas.markers,
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
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

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        if (!timeline) {
            return context.json({}, 200);
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
                where: (marker, { and, eq }) =>
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

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

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
