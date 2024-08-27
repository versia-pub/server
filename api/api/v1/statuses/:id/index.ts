import {
    apiRoute,
    applyConfig,
    auth,
    handleZodError,
    idValidator,
    jsonOrForm,
} from "@/api";
import { zValidator } from "@hono/zod-validator";
import ISO6391 from "iso-639-1";
import { z } from "zod";
import { RolePermissions } from "~/drizzle/schema";
import { config } from "~/packages/config-manager/index";
import { Attachment } from "~/packages/database-interface/attachment";
import { Note } from "~/packages/database-interface/note";

export const meta = applyConfig({
    allowedMethods: ["GET", "DELETE", "PUT"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id",
    auth: {
        required: false,
        methodOverrides: {
            DELETE: true,
            PUT: true,
        },
    },
    permissions: {
        required: [RolePermissions.ViewNotes],
        methodOverrides: {
            DELETE: [RolePermissions.ManageOwnNotes, RolePermissions.ViewNotes],
            PUT: [RolePermissions.ManageOwnNotes, RolePermissions.ViewNotes],
        },
    },
});

export const schemas = {
    param: z.object({
        id: z.string().regex(idValidator),
    }),
    json: z
        .object({
            status: z
                .string()
                .max(config.validation.max_note_size)
                .refine(
                    (s) =>
                        !config.filters.note_content.some((filter) =>
                            s.match(filter),
                        ),
                    "Status contains blocked words",
                )
                .optional(),
            content_type: z.string().optional().default("text/plain"),
            media_ids: z
                .array(z.string().regex(idValidator))
                .max(config.validation.max_media_attachments)
                .default([]),
            spoiler_text: z.string().max(255).optional(),
            sensitive: z
                .string()
                .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
                .or(z.boolean())
                .optional(),
            language: z
                .enum(ISO6391.getAllCodes() as [string, ...string[]])
                .optional(),
            "poll[options]": z
                .array(z.string().max(config.validation.max_poll_option_size))
                .max(config.validation.max_poll_options)
                .optional(),
            "poll[expires_in]": z.coerce
                .number()
                .int()
                .min(config.validation.min_poll_duration)
                .max(config.validation.max_poll_duration)
                .optional(),
            "poll[multiple]": z
                .string()
                .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
                .or(z.boolean())
                .optional(),
            "poll[hide_totals]": z
                .string()
                .transform((v) => ["true", "1", "on"].includes(v.toLowerCase()))
                .or(z.boolean())
                .optional(),
        })
        .refine(
            (obj) => !(obj.media_ids.length > 0 && obj["poll[options]"]),
            "Cannot attach poll to media",
        ),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        jsonOrForm(),
        zValidator("param", schemas.param, handleZodError),
        zValidator("json", schemas.json, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id } = context.req.valid("param");
            const { user } = context.req.valid("header");

            // TODO: Polls
            const {
                status: statusText,
                content_type,
                media_ids,
                spoiler_text,
                sensitive,
            } = context.req.valid("json");

            const note = await Note.fromId(id, user?.id);

            if (!note?.isViewableByUser(user)) {
                return context.json({ error: "Record not found" }, 404);
            }

            switch (context.req.method) {
                case "GET": {
                    return context.json(await note.toApi(user));
                }
                case "DELETE": {
                    if (note.author.id !== user?.id) {
                        return context.json({ error: "Unauthorized" }, 401);
                    }

                    // TODO: Delete and redraft

                    await note.delete();

                    await user.federateToFollowers(note.deleteToVersia());

                    return context.json(await note.toApi(user), 200);
                }
                case "PUT": {
                    if (!user) {
                        return context.json({ error: "Unauthorized" }, 401);
                    }

                    if (note.author.id !== user.id) {
                        return context.json({ error: "Unauthorized" }, 401);
                    }

                    if (media_ids.length > 0) {
                        const foundAttachments =
                            await Attachment.fromIds(media_ids);

                        if (foundAttachments.length !== media_ids.length) {
                            return context.json(
                                { error: "Invalid media IDs" },
                                422,
                            );
                        }
                    }

                    const newNote = await note.updateFromData({
                        author: user,
                        content: statusText
                            ? {
                                  [content_type]: {
                                      content: statusText,
                                      remote: false,
                                  },
                              }
                            : undefined,
                        isSensitive: sensitive,
                        spoilerText: spoiler_text,
                        mediaAttachments: media_ids,
                    });

                    return context.json(await newNote.toApi(user));
                }
            }
        },
    ),
);
