import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Application as ApplicationSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Application } from "@versia/kit/db";
import { ApiError } from "~/classes/errors/api-error";

const route = createRoute({
    method: "get",
    path: "/api/v1/apps/verify_credentials",
    summary: "Verify your app works",
    description: "Confirm that the app’s OAuth2 credentials work.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/apps/#verify_credentials",
    },
    tags: ["Apps"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnApps],
        }),
    ] as const,
    responses: {
        200: {
            description:
                "If the Authorization header was provided with a valid token, you should see your app returned as an Application entity.",
            content: {
                "application/json": {
                    schema: ApplicationSchema,
                },
            },
        },
        ...reusedResponses,
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

        return context.json(application.toApi(), 200);
    }),
);
