import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Application } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    route: "/api/v1/apps/verify_credentials",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnApps],
    },
});

const route = createRoute({
    method: "get",
    path: "/api/v1/apps/verify_credentials",
    summary: "Verify credentials",
    description: "Get your own application information",
    middleware: [auth(meta.auth, meta.permissions)],
    responses: {
        200: {
            description: "Application",
            content: {
                "application/json": {
                    schema: Application.schema,
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
        const { user, token } = context.get("auth");

        if (!token) {
            return context.json({ error: "Unauthorized" }, 401);
        }
        if (!user) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        const application = await Application.getFromToken(
            token.data.accessToken,
        );

        if (!application) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        return context.json(
            {
                ...application.toApi(),
                redirect_uris: application.data.redirectUri,
                scopes: application.data.scopes,
            },
            200,
        );
    }),
);
