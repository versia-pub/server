import { apiRoute, auth, jsonOrForm, withNoteParam } from "@/api";
import { Status as StatusSchema } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";
import { Note } from "@versia/kit/db";
import { Notes } from "@versia/kit/tables";
import { randomUUIDv7 } from "bun";
import { and, eq } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
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

            const existingReblog = await Note.fromSql(
                and(
                    eq(Notes.authorId, user.id),
                    eq(Notes.reblogId, note.data.id),
                ),
            );

            if (existingReblog) {
                return context.json(await existingReblog.toApi(user), 200);
            }

            const newReblog = await Note.insert({
                id: randomUUIDv7(),
                authorId: user.id,
                reblogId: note.data.id,
                visibility,
                sensitive: false,
                updatedAt: new Date().toISOString(),
                applicationId: null,
            });

            // Refetch the note *again* to get the proper value of .reblogged
            const finalNewReblog = await Note.fromId(newReblog.id, user?.id);

            if (!finalNewReblog) {
                throw new Error("Failed to reblog");
            }

            if (note.author.local && user.local) {
                await note.author.notify("reblog", user, newReblog);
            }

            return context.json(await finalNewReblog.toApi(user), 200);
        },
    ),
);
