import { RolePermission } from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import {
    apiRoute,
    auth,
    handleZodError,
    qsQuery,
} from "@versia-server/kit/api";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod/v4";

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
                ids: z.array(z.uuid()),
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
