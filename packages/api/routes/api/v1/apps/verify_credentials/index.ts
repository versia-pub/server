import {
    Application as ApplicationSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth } from "@versia-server/kit/api";
import { Application } from "@versia-server/kit/db";
import { describeRoute, resolver } from "hono-openapi";

export default apiRoute((app) =>
    app.get(
        "/api/v1/apps/verify_credentials",
        describeRoute({
            summary: "Verify your app works",
            description: "Confirm that the app’s OAuth2 credentials work.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/apps/#verify_credentials",
            },
            tags: ["Apps"],
            responses: {
                200: {
                    description:
                        "If the Authorization header was provided with a valid token, you should see your app returned as an Application entity.",
                    content: {
                        "application/json": {
                            schema: resolver(ApplicationSchema),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnApps],
        }),
        async (context) => {
            const { token } = context.get("auth");

            const application = await Application.getFromToken(
                token.data.accessToken,
            );

            if (!application) {
                throw ApiError.applicationNotFound();
            }

            return context.json(application.toApi(), 200);
        },
    ),
);
