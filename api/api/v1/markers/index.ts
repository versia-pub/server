import { apiRoute, auth, handleZodError } from "@/api";
import {
    Marker as MarkerSchema,
    Notification as NotificationSchema,
    Status as StatusSchema,
} from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { db } from "@versia/kit/db";
import { Markers } from "@versia/kit/tables";
import { type SQL, and, eq } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";

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
                    .or(z.enum(["home", "notifications"]).transform((t) => [t]))
                    .optional()
                    .openapi({
                        description:
                            "Specify the timeline(s) for which markers should be fetched. Possible values: home, notifications. If not provided, an empty object will be returned.",
                    }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { "timeline[]": timeline } = context.req.valid("query");
            const { user } = context.get("auth");

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
                    and(
                        eq(Markers.userId, user.id),
                        eq(Markers.timeline, "home"),
                    ),
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
                    "home[last_read_id]": StatusSchema.shape.id.openapi({
                        description:
                            "ID of the last status read in the home timeline.",
                        example: "c62aa212-8198-4ce5-a388-2cc8344a84ef",
                    }),
                    "notifications[last_read_id]":
                        NotificationSchema.shape.id.openapi({
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
                    updated_at: new Date(
                        insertedMarker.createdAt,
                    ).toISOString(),
                };
            }

            return context.json(markers, 200);
        },
    );
});
