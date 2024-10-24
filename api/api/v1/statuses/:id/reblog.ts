import { apiRoute, applyConfig, auth, jsonOrForm } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { Note } from "~/classes/database/note";
import { db } from "~/drizzle/db";
import { Notes, Notifications, RolePermissions } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/reblog",
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnBoosts, RolePermissions.ViewNotes],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z.object({
        visibility: z.enum(["public", "unlisted", "private"]).default("public"),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/reblog",
    summary: "Reblog a status",
    middleware: [auth(meta.auth, meta.permissions), jsonOrForm()],
    request: {
        params: schemas.param,
        body: {
            content: {
                "application/json": {
                    schema: schemas.json,
                },
                "application/x-www-form-urlencoded": {
                    schema: schemas.json,
                },
                "multipart/form-data": {
                    schema: schemas.json,
                },
            },
        },
    },
    responses: {
        201: {
            description: "Reblogged status",
            content: {
                "application/json": {
                    schema: Note.schema,
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
        404: {
            description: "Record not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        422: {
            description: "Already reblogged",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        500: {
            description: "Failed to reblog",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");
        const { visibility } = context.req.valid("json");
        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const foundStatus = await Note.fromId(id, user.id);

        if (!foundStatus?.isViewableByUser(user)) {
            return context.json({ error: "Record not found" }, 404);
        }

        const existingReblog = await Note.fromSql(
            and(
                eq(Notes.authorId, user.id),
                eq(Notes.reblogId, foundStatus.data.id),
            ),
        );

        if (existingReblog) {
            return context.json({ error: "Already reblogged" }, 422);
        }

        const newReblog = await Note.insert({
            authorId: user.id,
            reblogId: foundStatus.data.id,
            visibility,
            sensitive: false,
            updatedAt: new Date().toISOString(),
            applicationId: null,
        });

        if (!newReblog) {
            return context.json({ error: "Failed to reblog" }, 500);
        }

        const finalNewReblog = await Note.fromId(newReblog.id, user?.id);

        if (!finalNewReblog) {
            return context.json({ error: "Failed to reblog" }, 500);
        }

        if (foundStatus.author.isLocal() && user.isLocal()) {
            await db.insert(Notifications).values({
                accountId: user.id,
                notifiedId: foundStatus.author.id,
                type: "reblog",
                noteId: newReblog.data.reblogId,
            });
        }

        return context.json(await finalNewReblog.toApi(user), 201);
    }),
);
