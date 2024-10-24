import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { Note } from "~/classes/database/note";
import { RolePermissions } from "~/drizzle/schema";
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
    middleware: [auth(meta.auth, meta.permissions)],
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
            return context.json({ error: "Unauthorized" }, 401);
        }

        const status = await Note.fromId(id, user.id);

        if (!status) {
            return context.json({ error: "Record not found" }, 404);
        }

        if (status.author.id !== user.id) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        await user.unpin(status);

        if (!status) {
            return context.json({ error: "Record not found" }, 404);
        }

        return context.json(await status.toApi(user), 200);
    }),
);
