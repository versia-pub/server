import { apiRoute, auth, jsonOrForm, withNoteParam } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Note } from "@versia/kit/db";
import { Notes, RolePermissions } from "@versia/kit/tables";
import { and, eq } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";
import { Status } from "~/classes/schemas/status";
import { ErrorSchema } from "~/types/api";

const schemas = {
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
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnBoosts,
                RolePermissions.ViewNotes,
            ],
        }),
        jsonOrForm(),
        withNoteParam,
    ] as const,
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
                    schema: Status,
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
        const { visibility } = context.req.valid("json");
        const { user } = context.get("auth");
        const note = context.get("note");

        const existingReblog = await Note.fromSql(
            and(eq(Notes.authorId, user.id), eq(Notes.reblogId, note.data.id)),
        );

        if (existingReblog) {
            throw new ApiError(422, "Already reblogged");
        }

        const newReblog = await Note.insert({
            authorId: user.id,
            reblogId: note.data.id,
            visibility,
            sensitive: false,
            updatedAt: new Date().toISOString(),
            applicationId: null,
        });

        const finalNewReblog = await Note.fromId(newReblog.id, user?.id);

        if (!finalNewReblog) {
            throw new ApiError(500, "Failed to reblog");
        }

        if (note.author.isLocal() && user.isLocal()) {
            await note.author.notify("reblog", user, newReblog);
        }

        return context.json(await finalNewReblog.toApi(user), 201);
    }),
);
