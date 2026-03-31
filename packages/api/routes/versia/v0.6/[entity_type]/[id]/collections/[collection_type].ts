import * as VersiaEntities from "@versia/sdk/entities";
import {
    CollectionSchema,
    EntitySchema,
    URICollectionSchema,
} from "@versia/sdk/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, handleZodError } from "@versia-server/kit/api";
import { db, Instance, Note, User } from "@versia-server/kit/db";
import { Notes, Users } from "@versia-server/kit/tables";
import { and, eq, inArray, sql } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

export default apiRoute((app) =>
    app.get(
        "/.versia/v0.6/entities/:entity_type/:id/collections/:collection_type",
        describeRoute({
            summary:
                "Retrieve the Versia representation of a collection attached to an entity.",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "Collection",
                    content: {
                        "application/json": {
                            schema: resolver(
                                z.union([
                                    CollectionSchema,
                                    URICollectionSchema,
                                ]),
                            ),
                        },
                    },
                },
                404: {
                    description: "Collection not found.",
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
                collection_type: z.string(),
            }),
            handleZodError,
        ),
        validator(
            "query",
            z.object({
                limit: z.coerce.number().int().min(1).max(40).default(40),
                offset: z.coerce.number().int().nonnegative().default(0),
            }),
            handleZodError,
        ),
        async (context) => {
            const { entity_type, id, collection_type } =
                context.req.valid("param");
            const { limit, offset } = context.req.valid("query");

            let entity:
                | VersiaEntities.Collection
                | VersiaEntities.URICollection
                | null = null;

            switch (entity_type) {
                case "Note": {
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

                    switch (collection_type) {
                        case "replies": {
                            const replies = await Note.manyFromSql(
                                and(
                                    eq(Notes.replyId, note.id),
                                    inArray(Notes.visibility, [
                                        "public",
                                        "unlisted",
                                    ]),
                                ),
                                undefined,
                                limit,
                                offset,
                            );

                            const replyCount = await db.$count(
                                Notes,
                                and(
                                    eq(Notes.replyId, note.id),
                                    inArray(Notes.visibility, [
                                        "public",
                                        "unlisted",
                                    ]),
                                ),
                            );

                            entity = new VersiaEntities.URICollection({
                                author: note.author.id,
                                total: replyCount,
                                items: replies.map((reply) =>
                                    reply.reference.toString(),
                                ),
                            });
                            break;
                        }
                        case "quotes": {
                            const quotes = await Note.manyFromSql(
                                and(
                                    eq(Notes.quotingId, note.id),
                                    inArray(Notes.visibility, [
                                        "public",
                                        "unlisted",
                                    ]),
                                ),
                                undefined,
                                limit,
                                offset,
                            );

                            const quoteCount = await db.$count(
                                Notes,
                                and(
                                    eq(Notes.quotingId, note.id),
                                    inArray(Notes.visibility, [
                                        "public",
                                        "unlisted",
                                    ]),
                                ),
                            );

                            entity = new VersiaEntities.URICollection({
                                author: note.author.id,
                                total: quoteCount,
                                items: quotes.map((quote) =>
                                    quote.reference.toString(),
                                ),
                            });
                            break;
                        }
                        case "pub.versia:share/Shares": {
                            const shares = await Note.manyFromSql(
                                and(
                                    eq(Notes.reblogId, note.id),
                                    inArray(Notes.visibility, [
                                        "public",
                                        "unlisted",
                                    ]),
                                ),
                                undefined,
                                limit,
                                offset,
                            );

                            const shareCount = await db.$count(
                                Notes,
                                and(
                                    eq(Notes.reblogId, note.id),
                                    inArray(Notes.visibility, [
                                        "public",
                                        "unlisted",
                                    ]),
                                ),
                            );

                            entity = new VersiaEntities.URICollection({
                                author: note.author.id,
                                total: shareCount,
                                items: shares.map((share) =>
                                    share.reference.toString(),
                                ),
                            });
                            break;
                        }
                    }
                    break;
                }

                case "User": {
                    const user = await User.fromId(id);

                    if (!user || user.remote) {
                        throw ApiError.notFound();
                    }

                    switch (collection_type) {
                        case "outbox": {
                            const total = await db.$count(
                                Notes,
                                and(
                                    eq(Notes.authorId, id),
                                    inArray(Notes.visibility, [
                                        "public",
                                        "unlisted",
                                    ]),
                                ),
                            );

                            const outboxItems = await Note.manyFromSql(
                                and(
                                    eq(Notes.authorId, id),
                                    inArray(Notes.visibility, [
                                        "public",
                                        "unlisted",
                                    ]),
                                ),
                                undefined,
                                limit,
                                offset,
                            );

                            entity = new VersiaEntities.Collection({
                                author: user.id,
                                total,
                                items: outboxItems.map((note) =>
                                    note.toVersia(),
                                ),
                            });
                            break;
                        }

                        case "followers": {
                            if (user.data.isHidingCollections) {
                                entity = new VersiaEntities.URICollection({
                                    author: user.id,
                                    items: [],
                                    total: 0,
                                });
                                break;
                            }

                            const total = await db.$count(
                                Users,
                                sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${user.id} AND "Relationships"."ownerId" = ${Users.id} AND "Relationships"."following" = true)`,
                            );

                            const followers = await User.manyFromSql(
                                sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."subjectId" = ${user.id} AND "Relationships"."ownerId" = ${Users.id} AND "Relationships"."following" = true)`,
                                undefined,
                                limit,
                                offset,
                            );

                            entity = new VersiaEntities.URICollection({
                                author: user.id,
                                items: followers.map((follower) =>
                                    follower.reference.toString(),
                                ),
                                total,
                            });
                            break;
                        }

                        case "following": {
                            if (user.data.isHidingCollections) {
                                entity = new VersiaEntities.URICollection({
                                    author: user.id,
                                    items: [],
                                    total: 0,
                                });
                                break;
                            }

                            const total = await db.$count(
                                Users,
                                sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."ownerId" = ${user.id} AND "Relationships"."subjectId" = ${Users.id} AND "Relationships"."following" = true)`,
                            );

                            const following = await User.manyFromSql(
                                sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."ownerId" = ${user.id} AND "Relationships"."subjectId" = ${Users.id} AND "Relationships"."following" = true)`,
                                undefined,
                                limit,
                                offset,
                            );

                            entity = new VersiaEntities.URICollection({
                                author: user.id,
                                items: following.map((followed) =>
                                    followed.reference.toString(),
                                ),
                                total,
                            });
                            break;
                        }

                        default: {
                            throw ApiError.notFound();
                        }
                    }
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
