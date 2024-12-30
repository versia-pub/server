import { apiRoute, applyConfig, auth, idValidator } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Note, db } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import type { SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/pin",
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnNotes, RolePermissions.ViewNotes],
    },
});

export const schemas = {
    param: z.object({
        id: z.string().regex(idValidator),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/pin",
    summary: "Pin a status",
    middleware: [auth(meta.auth, meta.permissions)] as const,
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Pinned status",
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
            description: "Already pinned",
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
            throw new ApiError(401, "Unauthorized");
        }

        const foundStatus = await Note.fromId(id, user?.id);

        if (!foundStatus) {
            throw new ApiError(404, "Note not found");
        }

        if (foundStatus.author.id !== user.id) {
            throw new ApiError(401, "Unauthorized");
        }

        if (
            await db.query.UserToPinnedNotes.findFirst({
                where: (userPinnedNote, { and, eq }): SQL | undefined =>
                    and(
                        eq(userPinnedNote.noteId, foundStatus.data.id),
                        eq(userPinnedNote.userId, user.id),
                    ),
            })
        ) {
            throw new ApiError(422, "Already pinned");
        }

        await user.pin(foundStatus);

        return context.json(await foundStatus.toApi(user), 200);
    }),
);
