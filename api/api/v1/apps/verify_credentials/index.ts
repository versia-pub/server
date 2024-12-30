import { apiRoute, applyConfig, auth } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Application } from "@versia/kit/db";
import { RolePermissions } from "@versia/kit/tables";
import { ApiError } from "~/classes/errors/api-error";
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
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnApps],
        }),
    ] as const,
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
        const { token } = context.get("auth");

        if (!token) {
            throw new ApiError(401, "Unauthorized");
        }

        const application = await Application.getFromToken(
            token.data.accessToken,
        );

        if (!application) {
            throw new ApiError(401, "Application not found");
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
