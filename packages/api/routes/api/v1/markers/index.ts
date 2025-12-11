import {
    Marker as MarkerSchema,
    Notification as NotificationSchema,
    RolePermission,
    Status as StatusSchema,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, handleZodError } from "@versia-server/kit/api";
import { db } from "@versia-server/kit/db";
import { Markers } from "@versia-server/kit/tables";
import { randomUUIDv7 } from "bun";
import { and, eq, type SQL } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

const MarkerResponseSchema = z.object({
    notifications: MarkerSchema.optional(),
    home: MarkerSchema.optional(),
});

export default apiRoute((app) => {
    app.get(
        "/api/v1/markers",
        describeRoute({
            summary: "Get saved timeline positions",
            description: "Get current positions in timelines.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/markers/#get",
            },
            tags: ["Timelines"],
            responses: {
                200: {
                    description: "Markers",
                    content: {
                        "application/json": {
                            schema: resolver(MarkerResponseSchema),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnAccount],
        }),
        validator(
            "query",
            z.object({
                "timeline[]": z
                    .array(z.enum(["home", "notifications"]))
                    .max(2)
                    .or(z.enum(["home", "notifications"]))
                    .optional()
                    .meta({
                        description:
                            "Specify the timeline(s) for which markers should be fetched. Possible values: home, notifications. If not provided, an empty object will be returned.",
                    }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { "timeline[]": queryTimeline } = context.req.valid("query");
            const { user } = context.get("auth");

            if (!queryTimeline) {
                return context.json({}, 200);
            }

            const timeline = Array.isArray(queryTimeline)
                ? queryTimeline
                : [queryTimeline];

            const markers: z.infer<typeof MarkerResponseSchema> = {
                home: undefined,
                notifications: undefined,
            };

            if (timeline.includes("home")) {
                const found = await db.query.Markers.findFirst({
                    where: (marker): SQL | undefined =>
                        and(
                            eq(marker.userId, user.id),
                            eq(marker.timeline, "home"),
                        ),
                });

                const totalCount = await db.$count(
                    Markers,
                    and(
                        eq(Markers.userId, user.id),
                        eq(Markers.timeline, "home"),
                    ),
                );

                if (found?.noteId) {
                    markers.home = {
                        last_read_id: found.noteId,
                        version: totalCount,
                        updated_at: found.createdAt.toISOString(),
                    };
                }
            }

            if (timeline.includes("notifications")) {
                const found = await db.query.Markers.findFirst({
                    where: (marker): SQL | undefined =>
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
                        updated_at: found.createdAt.toISOString(),
                    };
                }
            }

            return context.json(markers, 200);
        },
    );

    app.post(
        "/api/v1/markers",
        describeRoute({
            summary: "Save your position in a timeline",
            description: "Save current position in timeline.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/markers/#create",
            },
            tags: ["Timelines"],
            responses: {
                200: {
                    description: "Markers",
                    content: {
                        "application/json": {
                            schema: resolver(MarkerResponseSchema),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnAccount],
        }),
        validator(
            "query",
            z
                .object({
                    "home[last_read_id]": StatusSchema.shape.id.meta({
                        description:
                            "ID of the last status read in the home timeline.",
                        example: "c62aa212-8198-4ce5-a388-2cc8344a84ef",
                    }),
                    "notifications[last_read_id]":
                        NotificationSchema.shape.id.meta({
                            description: "ID of the last notification read.",
                        }),
                })
                .partial(),
            handleZodError,
        ),
        async (context) => {
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
                            id: randomUUIDv7(),
                            userId: user.id,
                            timeline: "home",
                            noteId: homeId,
                        })
                        .returning()
                )[0];

                const totalCount = await db.$count(
                    Markers,
                    and(
                        eq(Markers.userId, user.id),
                        eq(Markers.timeline, "home"),
                    ),
                );

                markers.home = {
                    last_read_id: homeId,
                    version: totalCount,
                    updated_at: insertedMarker.createdAt.toISOString(),
                };
            }

            if (notificationsId) {
                const insertedMarker = (
                    await db
                        .insert(Markers)
                        .values({
                            id: randomUUIDv7(),
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
                    updated_at: insertedMarker.createdAt.toISOString(),
                };
            }

            return context.json(markers, 200);
        },
    );
});
