import { applyConfig, auth, handleZodError, jsonOrForm } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { Notes, Notifications, RolePermissions } from "~/drizzle/schema";
import { Note } from "~/packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/reblog",
    auth: {
        required: true,
    },
    permissions: {
        required: [
            RolePermissions.MANAGE_OWN_BOOSTS,
            RolePermissions.VIEW_NOTES,
        ],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
    form: z.object({
        visibility: z.enum(["public", "unlisted", "private"]).default("public"),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        jsonOrForm(),
        zValidator("param", schemas.param, handleZodError),
        zValidator("form", schemas.form, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");
            const { visibility } = context.req.valid("form");
            const { user } = context.req.valid("header");

            if (!user) return errorResponse("Unauthorized", 401);

            const foundStatus = await Note.fromId(id, user.id);

            if (!foundStatus?.isViewableByUser(user))
                return errorResponse("Record not found", 404);

            const existingReblog = await Note.fromSql(
                and(
                    eq(Notes.authorId, user.id),
                    eq(Notes.reblogId, foundStatus.getStatus().id),
                ),
            );

            if (existingReblog) {
                return errorResponse("Already reblogged", 422);
            }

            const newReblog = await Note.insert({
                authorId: user.id,
                reblogId: foundStatus.getStatus().id,
                visibility,
                sensitive: false,
                updatedAt: new Date().toISOString(),
                applicationId: null,
            });

            if (!newReblog) {
                return errorResponse("Failed to reblog", 500);
            }

            const finalNewReblog = await Note.fromId(newReblog.id, user?.id);

            if (!finalNewReblog) {
                return errorResponse("Failed to reblog", 500);
            }

            if (foundStatus.getAuthor().isLocal() && user.isLocal()) {
                await db.insert(Notifications).values({
                    accountId: user.id,
                    notifiedId: foundStatus.getAuthor().id,
                    type: "reblog",
                    noteId: newReblog.reblogId,
                });
            }

            return jsonResponse(await finalNewReblog.toAPI(user));
        },
    );
