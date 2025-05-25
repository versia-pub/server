import {
    NoteReactionWithAccounts,
    RolePermission,
} from "@versia/client/schemas";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";
import { apiRoute, auth, withNoteParam } from "@/api";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.get(
        "/api/v1/statuses/:id/reactions",
        describeRoute({
            summary: "Get reactions for a status",
            description:
                "Get a list of all the users who reacted to a note. Only IDs are returned, not full account objects, to improve performance on very popular notes.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/statuses/#reactions",
            },
            tags: ["Statuses"],
            responses: {
                200: {
                    description: "List of reactions and associated users",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(NoteReactionWithAccounts)),
                        },
                    },
                },
                404: ApiError.noteNotFound().schema,
            },
        }),
        auth({
            auth: false,
            permissions: [RolePermission.ViewNotes],
        }),
        withNoteParam,
        (context) => {
            const { user } = context.get("auth");
            const note = context.get("note");

            // Get reactions for the note using the new method
            const reactions = note.getReactions(user ?? undefined);

            return context.json(reactions);
        },
    ),
);
