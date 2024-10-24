import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { Note } from "~/classes/database/note";
import { Notes, RolePermissions } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
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

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/unreblog",
    summary: "Unreblog a status",
    middleware: [auth(meta.auth, meta.permissions)],
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Unreblogged status",
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
            description: "Not already reblogged",
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
        const { user } = context.get("auth");

        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const foundStatus = await Note.fromId(id, user.id);

        // Check if user is authorized to view this status (if it's private)
        if (!foundStatus?.isViewableByUser(user)) {
            return context.json({ error: "Record not found" }, 404);
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
            return context.json({ error: "Not already reblogged" }, 422);
        }

        await existingReblog.delete();

        await user.federateToFollowers(existingReblog.deleteToVersia());

        const newNote = await Note.fromId(id, user.id);

        if (!newNote) {
            return context.json({ error: "Record not found" }, 404);
        }

        return context.json(await newNote.toApi(user), 200);
    }),
);
