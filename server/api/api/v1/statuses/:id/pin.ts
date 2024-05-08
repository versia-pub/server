import { applyConfig, auth, handleZodError, idValidator } from "@api";
import { zValidator } from "@hono/zod-validator";
import { errorResponse, jsonResponse } from "@response";
import type { Hono } from "hono";
import { z } from "zod";
import { db } from "~drizzle/db";
import { Note } from "~packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/pin",
    auth: {
        required: true,
    },
});

export const schemas = {
    param: z.object({
        id: z.string().regex(idValidator),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth),
        async (context) => {
            const { id } = context.req.valid("param");
            const { user } = context.req.valid("header");

            if (!user) return errorResponse("Unauthorized", 401);

            const foundStatus = await Note.fromId(id, user?.id);

            if (!foundStatus) return errorResponse("Record not found", 404);

            if (foundStatus.getAuthor().id !== user.id)
                return errorResponse("Unauthorized", 401);

            if (
                await db.query.UserToPinnedNotes.findFirst({
                    where: (userPinnedNote, { and, eq }) =>
                        and(
                            eq(
                                userPinnedNote.noteId,
                                foundStatus.getStatus().id,
                            ),
                            eq(userPinnedNote.userId, user.id),
                        ),
                })
            ) {
                return errorResponse("Already pinned", 422);
            }

            await user.pin(foundStatus);

            return jsonResponse(await foundStatus.toAPI(user));
        },
    );
