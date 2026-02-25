import type * as VersiaEntities from "@versia/sdk/entities";
import {
    DislikeSchema,
    EntitySchema,
    LikeSchema,
    NoteSchema,
    ReactionSchema,
    ShareSchema,
    UserSchema,
} from "@versia/sdk/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, handleZodError } from "@versia-server/kit/api";
import { Instance, Like, Note, Reaction, User } from "@versia-server/kit/db";
import { Likes, Notes } from "@versia-server/kit/tables";
import { and, eq, inArray, sql } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

export default apiRoute((app) =>
    app.get(
        "/.versia/v0.6/entities/:entity_type/:id",
        describeRoute({
            summary: "Retrieve the Versia representation of an entity.",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Entity",
                    content: {
                        "application/json": {
                            schema: resolver(
                                z.union([
                                    NoteSchema,
                                    UserSchema,
                                    LikeSchema,
                                    DislikeSchema,
                                    ReactionSchema,
                                    ShareSchema,
                                ]),
                            ),
                        },
                    },
                },
                301: {
                    description:
                        "Redirect to user profile (for web browsers). Uses Accept header for detection.",
                },
                404: {
                    description:
                        "Entity not found, is remote, or the requester is not allowed to view it.",
                    content: {
                        "application/json": {
                            schema: resolver(ApiError.zodSchema),
                        },
                    },
                },
            },
        }),
        validator(
            "param",
            z.object({
                entity_type: EntitySchema.shape.type,
                id: EntitySchema.shape.id,
            }),
            handleZodError,
        ),
        async (context) => {
            const { entity_type, id } = context.req.valid("param");

            let entity:
                | VersiaEntities.Note
                | VersiaEntities.User
                | VersiaEntities.Like
                | VersiaEntities.Dislike
                | VersiaEntities.Reaction
                | VersiaEntities.Share
                | null = null;

            switch (entity_type) {
                case "pub.versia:notes/Note": {
                    const note = await Note.fromSql(
                        and(
                            eq(Notes.id, id),
                            inArray(Notes.visibility, ["public", "unlisted"]),
                        ),
                    );

                    if (
                        !(note && (await note.isViewableByUser(null))) ||
                        note.remote
                    ) {
                        throw ApiError.noteNotFound();
                    }

                    entity = note.toVersia();
                    break;
                }
                case "pub.versia:users/User": {
                    const user = await User.fromId(id);

                    if (!user || user.remote) {
                        throw ApiError.accountNotFound();
                    }

                    entity = user.toVersia();
                    break;
                }
                case "pub.versia:likes/Like": {
                    // Don't fetch a like of a note that is not public or unlisted
                    // prevents leaking the existence of a private note
                    const like = await Like.fromSql(
                        and(
                            eq(Likes.id, id),
                            sql`EXISTS (SELECT 1 FROM "Notes" WHERE "Notes"."id" = ${Likes.likedId} AND "Notes"."visibility" IN ('public', 'unlisted'))`,
                        ),
                    );

                    if (!like) {
                        throw ApiError.likeNotFound();
                    }

                    const liker = await User.fromId(like.data.likerId);

                    if (!liker || liker.remote) {
                        throw ApiError.accountNotFound();
                    }

                    entity = like.toVersia();
                    break;
                }
                case "pub.versia:likes/Dislike": {
                    // Versia Server does not support dislikes
                    throw ApiError.notFound();
                }
                case "pub.versia:shares/Share": {
                    const note = await Note.fromSql(
                        and(
                            eq(Notes.id, id),
                            inArray(Notes.visibility, ["public", "unlisted"]),
                        ),
                    );

                    if (
                        !(note && (await note.isViewableByUser(null))) ||
                        note.remote ||
                        !note.data.reblogId
                    ) {
                        throw ApiError.notFound();
                    }

                    entity = note.toVersiaShare();
                    break;
                }
                case "pub.versia:reactions/Reaction": {
                    const reaction = await Reaction.fromId(id);

                    if (!reaction) {
                        throw ApiError.notFound();
                    }

                    entity = reaction.toVersia();
                    break;
                }
            }

            if (!entity) {
                throw ApiError.notFound();
            }

            const { headers } = await Instance.sign(
                entity,
                new URL(context.req.url),
                "GET",
            );

            return context.json(entity, 200, headers.toJSON());
        },
    ),
);
