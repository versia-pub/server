import { RolePermission, Status as StatusSchema } from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, auth, withNoteParam } from "@versia-server/kit/api";
import { db } from "@versia-server/kit/db";
import { and, eq, type SQL } from "drizzle-orm";
import { describeRoute, resolver } from "hono-openapi";

export default apiRoute((app) =>
    app.post(
        "/api/v1/statuses/:id/pin",
        describeRoute({
            summary: "Pin status to profile",
            description:
                "Feature one of your own public statuses at the top of your profile.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#pin",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description:
                        "Status pinned. Note the status is not a reblog and its authoring account is your own.",
                    content: {
                        "application/json": {
                            schema: resolver(StatusSchema),
                        },
                    },
                },
                404: ApiError.noteNotFound().schema,
                403: ApiError.forbidden().schema,
                401: ApiError.missingAuthentication().schema,
            },
        }),

        auth({
            auth: true,
            permissions: [
                RolePermission.ManageOwnNotes,
                RolePermission.ViewNotes,
            ],
        }),
        withNoteParam,
        async (context) => {
            const { user } = context.get("auth");
            const note = context.get("note");

            if (note.author.id !== user.id) {
                throw ApiError.forbidden();
            }

            if (
                await db.query.UserToPinnedNotes.findFirst({
                    where: (userPinnedNote): SQL | undefined =>
                        and(
                            eq(userPinnedNote.noteId, note.data.id),
                            eq(userPinnedNote.userId, user.id),
                        ),
                })
            ) {
                return context.json(await note.toApi(user), 200);
            }

            await user.pin(note);

            return context.json(await note.toApi(user), 200);
        },
    ),
);
