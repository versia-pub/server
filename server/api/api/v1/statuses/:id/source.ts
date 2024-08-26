import { apiRoute, applyConfig, auth, handleZodError } from "@/api";
import { zValidator } from "@hono/zod-validator";
import type { StatusSource as ApiStatusSource } from "@versia/client/types";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { Note } from "~/packages/database-interface/note";

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
    permissions: {
        required: [RolePermissions.ManageOwnNotes, RolePermissions.ViewNotes],
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

            const status = await Note.fromId(id, user.id);

            if (!status?.isViewableByUser(user)) {
                return context.json({ error: "Record not found" }, 404);
            }

            return context.json({
                id: status.id,
                // TODO: Give real source for spoilerText
                spoiler_text: status.data.spoilerText,
                text: status.data.contentSource,
            } as ApiStatusSource);
        },
    ),
);
