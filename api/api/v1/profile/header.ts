import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { User } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    ratelimits: {
        max: 10,
        duration: 60,
    },
    route: "/api/v1/profile/header",
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnAccount],
    },
});

const route = createRoute({
    method: "delete",
    path: "/api/v1/profile/header",
    summary: "Delete header",
    middleware: [auth(meta.auth, meta.permissions)],
    responses: {
        200: {
            description: "User",
            content: {
                "application/json": {
                    schema: User.schema,
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
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user: self } = context.get("auth");

        if (!self) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        await self.update({
            header: "",
        });

        return context.json(self.toApi(true), 200);
    }),
);
