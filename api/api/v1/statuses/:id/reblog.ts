import {
    apiRoute,
    auth,
    jsonOrForm,
    noteNotFound,
    reusedResponses,
    withNoteParam,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { Note } from "@versia/kit/db";
import { Notes, RolePermissions } from "@versia/kit/tables";
import { and, eq } from "drizzle-orm";
import { Status as StatusSchema } from "~/classes/schemas/status";

const route = createRoute({
    method: "post",
    path: "/api/v1/statuses/{id}/reblog",
    summary: "Boost a status",
    description: "Reshare a status on your own profile.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/statuses/#boost",
    },
    tags: ["Statuses"],
    middleware: [
        auth({
            auth: true,
            permissions: [
                RolePermissions.ManageOwnBoosts,
                RolePermissions.ViewNotes,
            ],
        }),
        jsonOrForm(),
        withNoteParam,
    ] as const,
    request: {
        params: z.object({
            id: StatusSchema.shape.id,
        }),
        body: {
            content: {
                "application/json": {
                    schema: z.object({
                        visibility:
                            StatusSchema.shape.visibility.default("public"),
                    }),
                },
                "application/x-www-form-urlencoded": {
                    schema: z.object({
                        visibility:
                            StatusSchema.shape.visibility.default("public"),
                    }),
                },
                "multipart/form-data": {
                    schema: z.object({
                        visibility:
                            StatusSchema.shape.visibility.default("public"),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description:
                "Status has been reblogged. Note that the top-level ID has changed. The ID of the boosted status is now inside the reblog property. The top-level ID is the ID of the reblog itself. Also note that reblogs cannot be pinned.",
            content: {
                "application/json": {
                    schema: StatusSchema,
                },
            },
        },
        404: noteNotFound,
        ...reusedResponses,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { visibility } = context.req.valid("json");
        const { user } = context.get("auth");
        const note = context.get("note");

        const existingReblog = await Note.fromSql(
            and(eq(Notes.authorId, user.id), eq(Notes.reblogId, note.data.id)),
        );

        if (existingReblog) {
            return context.json(await existingReblog.toApi(user), 200);
        }

        const newReblog = await Note.insert({
            authorId: user.id,
            reblogId: note.data.id,
            visibility,
            sensitive: false,
            updatedAt: new Date().toISOString(),
            applicationId: null,
        });

        if (note.author.isLocal() && user.isLocal()) {
            await note.author.notify("reblog", user, newReblog);
        }

        return context.json(await newReblog.toApi(user), 200);
    }),
);
