import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { getFromToken } from "~/classes/functions/application";
import { RolePermissions } from "~/drizzle/schema";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    allowedMethods: ["GET"],
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
                    schema: z.object({
                        name: z.string(),
                        website: z.string().nullable(),
                        vapid_key: z.string().nullable(),
                        redirect_uris: z.string(),
                        scopes: z.string(),
                    }),
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

        const application = await getFromToken(token);

        if (!application) {
            return context.json({ error: "Unauthorized" }, 401);
        }

        return context.json(
            {
                name: application.name,
                website: application.website,
                vapid_key: application.vapidKey,
                redirect_uris: application.redirectUri,
                scopes: application.scopes,
            },
            200,
        );
    }),
);
