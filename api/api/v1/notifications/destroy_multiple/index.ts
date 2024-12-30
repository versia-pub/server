import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { RolePermissions } from "@versia/kit/tables";
import { z } from "zod";

export const meta = applyConfig({
    route: "/api/v1/notifications/destroy_multiple",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
        oauthPermissions: ["write:notifications"],
    },
    permissions: {
        required: [RolePermissions.ManageOwnNotifications],
    },
});

export const schemas = {
    query: z.object({
        "ids[]": z.array(z.string().uuid()),
    }),
};

const route = createRoute({
    method: "delete",
    path: "/api/v1/notifications/destroy_multiple",
    summary: "Dismiss multiple notifications",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnNotifications],
            scopes: ["write:notifications"],
        }),
    ] as const,
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "Notifications dismissed",
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");

        const { "ids[]": ids } = context.req.valid("query");

        await user.clearSomeNotifications(ids);

        return context.text("", 200);
    }),
);
