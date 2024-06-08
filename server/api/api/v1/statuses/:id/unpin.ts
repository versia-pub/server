import { applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { Note } from "~/packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/unpin",
    auth: {
        required: true,
    },
    permissions: {
        required: [
            RolePermissions.MANAGE_OWN_NOTES,
            RolePermissions.VIEW_NOTES,
        ],
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

            if (!user) return errorResponse("Unauthorized", 401);

            const status = await Note.fromId(id, user.id);

            if (!status) return errorResponse("Record not found", 404);

            if (status.getAuthor().id !== user.id)
                return errorResponse("Unauthorized", 401);

            await user.unpin(status);

            if (!status) return errorResponse("Record not found", 404);

            return jsonResponse(await status.toAPI(user));
        },
    );
