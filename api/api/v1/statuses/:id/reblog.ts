import { apiRoute, applyConfig, auth, jsonOrForm } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Note } from "@versia/kit/db";
import { Notes, RolePermissions } from "@versia/kit/tables";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
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
            throw new ApiError(401, "Unauthorized");
        }

        const note = await Note.fromId(id, user.id);

        if (!(note && (await note?.isViewableByUser(user)))) {
            throw new ApiError(404, "Note not found");
        }

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
