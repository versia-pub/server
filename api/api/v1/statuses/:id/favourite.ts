import { apiRoute, applyConfig, auth, handleZodError } from "@/api";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createLike } from "~/classes/functions/like";
import { db } from "~/drizzle/db";
import { RolePermissions } from "~/drizzle/schema";
import { Note } from "~/packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/favourite",
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnLikes, RolePermissions.ViewNotes],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().uuid(),
    }),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");

            const { user } = context.req.valid("header");

            if (!user) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            const note = await Note.fromId(id, user?.id);

            if (!note?.isViewableByUser(user)) {
                return context.json({ error: "Record not found" }, 404);
            }

            const existingLike = await db.query.Likes.findFirst({
                where: (like, { and, eq }) =>
                    and(
                        eq(like.likedId, note.data.id),
                        eq(like.likerId, user.id),
                    ),
            });

            if (!existingLike) {
                await createLike(user, note);
            }

            const newNote = await Note.fromId(id, user.id);

            if (!newNote) {
                return context.json({ error: "Record not found" }, 404);
            }

            return context.json(await newNote.toApi(user));
        },
    ),
);