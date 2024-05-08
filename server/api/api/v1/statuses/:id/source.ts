import { applyConfig, auth, handleZodError } from "@api";
import { zValidator } from "@hono/zod-validator";
import { errorResponse, jsonResponse } from "@response";
import type { Hono } from "hono";
import { z } from "zod";
import { Note } from "~packages/database-interface/note";
import type { StatusSource as APIStatusSource } from "~types/mastodon/status_source";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/source",
    auth: {
        required: true,
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
        auth(meta.auth),
        async (context) => {
            const { id } = context.req.valid("param");
            const { user } = context.req.valid("header");

            if (!user) return errorResponse("Unauthorized", 401);

            const status = await Note.fromId(id, user.id);

            if (!status?.isViewableByUser(user))
                return errorResponse("Record not found", 404);

            return jsonResponse({
                id: status.id,
                // TODO: Give real source for spoilerText
                spoiler_text: status.getStatus().spoilerText,
                text: status.getStatus().contentSource,
            } as APIStatusSource);
        },
    );
