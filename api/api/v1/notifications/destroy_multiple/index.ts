import { RolePermission } from "@versia/client/schemas";
import { describeRoute } from "hono-openapi";
import { validator } from "hono-openapi/zod";
import { z } from "zod";
import { apiRoute, auth, handleZodError, qsQuery } from "@/api";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.delete(
        "/api/v1/notifications/destroy_multiple",
        describeRoute({
            summary: "Dismiss multiple notifications",
            tags: ["Notifications"],
            responses: {
                200: {
                    description: "Notifications dismissed",
                },
                401: ApiError.missingAuthentication().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnNotifications],
            scopes: ["write:notifications"],
        }),
        qsQuery(),
        validator(
            "query",
            z.object({
                ids: z.array(z.string().uuid()),
            }),
            handleZodError,
        ),
        async (context) => {
            const { user } = context.get("auth");

            const { ids } = context.req.valid("query");

            await user.clearSomeNotifications(ids);

            return context.text("", 200);
        },
    ),
);
