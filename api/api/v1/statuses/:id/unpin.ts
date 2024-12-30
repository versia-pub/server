import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Note } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/unpin",
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
    path: "/api/v1/statuses/{id}/unpin",
    summary: "Unpin a status",
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnNotes,
                RolePermissions.ViewNotes,
            ],
        }),
    ] as const,
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Unpinned status",
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
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { id } = context.req.valid("param");
        const { user } = context.get("auth");

        if (!user) {
            throw new ApiError(401, "Unauthorized");
        }

        const status = await Note.fromId(id, user.id);

        if (!status) {
            throw new ApiError(404, "Note not found");
        }

        if (status.author.id !== user.id) {
            throw new ApiError(401, "Unauthorized");
        }

        await user.unpin(status);

        if (!status) {
            throw new ApiError(404, "Note not found");
        }

        return context.json(await status.toApi(user), 200);
    }),
);
