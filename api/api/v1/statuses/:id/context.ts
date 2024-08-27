import { apiRoute, applyConfig, auth, handleZodError } from "@/api";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { Note } from "~/packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    ratelimits: {
        max: 8,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/context",
    auth: {
        required: false,
    },
    permissions: {
        required: [RolePermissions.ViewNotes],
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

            const { user } = context.get("auth");

            const foundStatus = await Note.fromId(id, user?.id);

            if (!foundStatus) {
                return context.json({ error: "Record not found" }, 404);
            }

            const ancestors = await foundStatus.getAncestors(user ?? null);

            const descendants = await foundStatus.getDescendants(user ?? null);

            return context.json({
                ancestors: await Promise.all(
                    ancestors.map((status) => status.toApi(user)),
                ),
                descendants: await Promise.all(
                    descendants.map((status) => status.toApi(user)),
                ),
            });
        },
    ),
);
