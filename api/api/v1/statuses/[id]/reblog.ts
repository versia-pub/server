import { RolePermission, Status as StatusSchema } from "@versia/client/schemas";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { apiRoute, auth, jsonOrForm, withNoteParam } from "@/api";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.post(
        "/api/v1/statuses/:id/reblog",
        describeRoute({
            summary: "Boost a status",
            description: "Reshare a status on your own profile.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#boost",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description:
                        "Status has been reblogged. Note that the top-level ID has changed. The ID of the boosted status is now inside the reblog property. The top-level ID is the ID of the reblog itself. Also note that reblogs cannot be pinned.",
                    content: {
                        "application/json": {
                            schema: resolver(StatusSchema),
                        },
                    },
                },
                404: ApiError.noteNotFound().schema,
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [
                RolePermission.ManageOwnBoosts,
                RolePermission.ViewNotes,
            ],
        }),
        jsonOrForm(),
        withNoteParam,
        validator(
            "json",
            z.object({
                visibility: StatusSchema.shape.visibility.default("public"),
            }),
        ),
        async (context) => {
            const { visibility } = context.req.valid("json");
            const { user } = context.get("auth");
            const note = context.get("note");

            const reblog = await user.reblog(note, visibility);

            return context.json(await reblog.toApi(user), 200);
        },
    ),
);
