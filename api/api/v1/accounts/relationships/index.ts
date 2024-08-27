import { apiRoute, applyConfig, auth, handleZodError, qsQuery } from "@/api";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { Relationship } from "~/packages/database-interface/relationship";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/accounts/relationships",
    ratelimits: {
        max: 30,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["read:follows"],
    },
    permissions: {
        required: [RolePermissions.ManageOwnFollows],
    },
});

export const schemas = {
    query: z.object({
        id: z.array(z.string().uuid()).min(1).max(10).or(z.string().uuid()),
    }),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        qsQuery(),
        zValidator("query", schemas.query, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { user: self } = context.get("auth");
            const { id } = context.req.valid("query");

            const ids = Array.isArray(id) ? id : [id];

            if (!self) {
                return context.json({ error: "Unauthorized" }, 401);
            }

            const relationships = await Relationship.fromOwnerAndSubjects(
                self,
                ids,
            );

            relationships.sort(
                (a, b) =>
                    ids.indexOf(a.data.subjectId) -
                    ids.indexOf(b.data.subjectId),
            );

            return context.json(relationships.map((r) => r.toApi()));
        },
    ),
);
