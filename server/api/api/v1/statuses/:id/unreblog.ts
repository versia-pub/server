import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { undoFederationRequest } from "~/classes/functions/federation";
import { Notes, RolePermissions } from "~/drizzle/schema";
import { Note } from "~/packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/unreblog",
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnNotes, RolePermissions.ViewNotes],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");
            const { user } = context.req.valid("header");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            const foundStatus = await Note.fromId(id, user.id);

            // Check if user is authorized to view this status (if it's private)
            if (!foundStatus?.isViewableByUser(user)) {
                return errorResponse("Record not found", 404);
            }

            const existingReblog = await Note.fromSql(
                and(
                    eq(Notes.authorId, user.id),
                    eq(Notes.reblogId, foundStatus.data.id),
                ),
                undefined,
                user?.id,
            );

            if (!existingReblog) {
                return errorResponse("Not already reblogged", 422);
            }

            await existingReblog.delete();

            await user.federateToFollowers(
                undoFederationRequest(user, existingReblog.getUri()),
            );

            const newNote = await Note.fromId(id, user.id);

            if (!newNote) {
                return errorResponse("Record not found", 404);
            }

            return jsonResponse(await newNote.toApi(user));
        },
    );
