import type {
    NoteReactionWithAccounts,
    Status as StatusSchema,
} from "@versia/client/schemas";
import * as VersiaEntities from "@versia/sdk/entities";
import { FederationRequester } from "@versia/sdk/http";
import type { NonTextContentFormatSchema } from "@versia/sdk/schemas";
import { config } from "@versia-server/config";
import { randomUUIDv7 } from "bun";
import {
    and,
    desc,
    eq,
    type InferInsertModel,
    type InferSelectModel,
    inArray,
    isNotNull,
    type SQL,
    sql,
} from "drizzle-orm";
import { htmlToText } from "html-to-text";
import { createRegExp, exactly, global } from "magic-regexp";
import type { z } from "zod/v4";
import { mergeAndDeduplicate } from "@/lib.ts";
import { sanitizedHtmlStrip } from "@/sanitization";
import { versiaTextToHtml } from "../parsers.ts";
import { DeliveryJobType, deliveryQueue } from "../queues/delivery/queue.ts";
import { uuid } from "../regex.ts";
import { db } from "../tables/db.ts";
import {
    EmojiToNote,
    Likes,
    MediasToNotes,
    Notes,
    NoteToMentions,
    Notifications,
    Users,
} from "../tables/schema.ts";
import { Client } from "./application.ts";
import { BaseInterface } from "./base.ts";
import { Emoji } from "./emoji.ts";
import { Instance } from "./instance.ts";
import { Like } from "./like.ts";
import { Media } from "./media.ts";
import { Reaction } from "./reaction.ts";
import {
    transformOutputToUserWithRelations,
    User,
    userRelations,
} from "./user.ts";

/**
 * Wrapper against the Status object to make it easier to work with
 * @param query
 * @returns
 */
const findManyNotes = async (
    query: Parameters<typeof db.query.Notes.findMany>[0],
    userId?: string,
): Promise<(typeof Note.$type)[]> => {
    const output = await db.query.Notes.findMany({
        ...query,
        with: {
            ...query?.with,
            attachments: {
                with: {
                    media: true,
                },
            },
            reactions: {
                with: {
                    emoji: {
                        with: {
                            instance: true,
                            media: true,
                        },
                    },
                },
            },
            emojis: {
                with: {
                    emoji: {
                        with: {
                            instance: true,
                            media: true,
                        },
                    },
                },
            },
            author: {
                with: {
                    ...userRelations,
                },
            },
            mentions: {
                with: {
                    user: {
                        with: {
                            instance: true,
                        },
                    },
                },
            },
            reblog: {
                with: {
                    attachments: {
                        with: {
                            media: true,
                        },
                    },
                    reactions: {
                        with: {
                            emoji: {
                                with: {
                                    instance: true,
                                    media: true,
                                },
                            },
                        },
                    },
                    emojis: {
                        with: {
                            emoji: {
                                with: {
                                    instance: true,
                                    media: true,
                                },
                            },
                        },
                    },
                    likes: true,
                    client: true,
                    mentions: {
                        with: {
                            user: {
                                with: userRelations,
                            },
                        },
                    },
                    author: {
                        with: {
                            ...userRelations,
                        },
                    },
                },
                extras: {
                    pinned: userId
                        ? sql`EXISTS (SELECT 1 FROM "UserToPinnedNotes" WHERE "UserToPinnedNotes"."noteId" = "Notes_reblog".id AND "UserToPinnedNotes"."userId" = ${userId})`.as(
                              "pinned",
                          )
                        : sql`false`.as("pinned"),
                    reblogged: userId
                        ? sql`EXISTS (SELECT 1 FROM "Notes" WHERE "Notes"."authorId" = ${userId} AND "Notes"."reblogId" = "Notes_reblog".id)`.as(
                              "reblogged",
                          )
                        : sql`false`.as("reblogged"),
                    muted: userId
                        ? sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."ownerId" = ${userId} AND "Relationships"."subjectId" = "Notes_reblog"."authorId" AND "Relationships"."muting" = true)`.as(
                              "muted",
                          )
                        : sql`false`.as("muted"),
                    liked: userId
                        ? sql`EXISTS (SELECT 1 FROM "Likes" WHERE "Likes"."likedId" = "Notes_reblog".id AND "Likes"."likerId" = ${userId})`.as(
                              "liked",
                          )
                        : sql`false`.as("liked"),
                },
            },
            reply: true,
            quote: true,
        },
        extras: {
            pinned: userId
                ? sql`EXISTS (SELECT 1 FROM "UserToPinnedNotes" WHERE "UserToPinnedNotes"."noteId" = "Notes".id AND "UserToPinnedNotes"."userId" = ${userId})`.as(
                      "pinned",
                  )
                : sql`false`.as("pinned"),
            reblogged: userId
                ? sql`EXISTS (SELECT 1 FROM "Notes" WHERE "Notes"."authorId" = ${userId} AND "Notes"."reblogId" = "Notes".id)`.as(
                      "reblogged",
                  )
                : sql`false`.as("reblogged"),
            muted: userId
                ? sql`EXISTS (SELECT 1 FROM "Relationships" WHERE "Relationships"."ownerId" = ${userId} AND "Relationships"."subjectId" = "Notes"."authorId" AND "Relationships"."muting" = true)`.as(
                      "muted",
                  )
                : sql`false`.as("muted"),
            liked: userId
                ? sql`EXISTS (SELECT 1 FROM "Likes" WHERE "Likes"."likedId" = "Notes".id AND "Likes"."likerId" = ${userId})`.as(
                      "liked",
                  )
                : sql`false`.as("liked"),
            ...query?.extras,
        },
    });

    return output.map((post) => ({
        ...post,
        author: transformOutputToUserWithRelations(post.author),
        mentions: post.mentions.map((mention) => ({
            ...mention.user,
            endpoints: mention.user.endpoints,
        })),
        attachments: post.attachments.map((attachment) => attachment.media),
        emojis: (post.emojis ?? []).map((emoji) => emoji.emoji),
        reblog: post.reblog && {
            ...post.reblog,
            author: transformOutputToUserWithRelations(post.reblog.author),
            mentions: post.reblog.mentions.map((mention) => ({
                ...mention.user,
                endpoints: mention.user.endpoints,
            })),
            attachments: post.reblog.attachments.map(
                (attachment) => attachment.media,
            ),
            emojis: (post.reblog.emojis ?? []).map((emoji) => emoji.emoji),
            pinned: Boolean(post.reblog.pinned),
            reblogged: Boolean(post.reblog.reblogged),
            muted: Boolean(post.reblog.muted),
            liked: Boolean(post.reblog.liked),
        },
        pinned: Boolean(post.pinned),
        reblogged: Boolean(post.reblogged),
        muted: Boolean(post.muted),
        liked: Boolean(post.liked),
    }));
};

type NoteType = InferSelectModel<typeof Notes>;

type NoteTypeWithRelations = NoteType & {
    author: typeof User.$type;
    mentions: (InferSelectModel<typeof Users> & {
        instance: typeof Instance.$type | null;
    })[];
    attachments: (typeof Media.$type)[];
    reblog: NoteTypeWithoutRecursiveRelations | null;
    emojis: (typeof Emoji.$type)[];
    reply: NoteType | null;
    quote: NoteType | null;
    client: typeof Client.$type | null;
    pinned: boolean;
    reblogged: boolean;
    muted: boolean;
    liked: boolean;
    reactions: Omit<typeof Reaction.$type, "note" | "author">[];
};

export type NoteTypeWithoutRecursiveRelations = Omit<
    NoteTypeWithRelations,
    "reply" | "quote" | "reblog"
>;

/**
 * Gives helpers to fetch notes from database in a nice format
 */
export class Note extends BaseInterface<typeof Notes, NoteTypeWithRelations> {
    public static $type: NoteTypeWithRelations;

    public save(): Promise<NoteTypeWithRelations> {
        return this.update(this.data);
    }

    /**
     * @param userRequestingNoteId Used to calculate visibility of the note
     */
    public async reload(userRequestingNoteId?: string): Promise<void> {
        const reloaded = await Note.fromId(this.data.id, userRequestingNoteId);

        if (!reloaded) {
            throw new Error("Failed to reload status");
        }

        this.data = reloaded.data;
    }

    /**
     * Insert a new note into the database
     * @param data - The data to insert
     * @param userRequestingNoteId - The ID of the user requesting the note (used to check visibility of the note)
     * @returns The inserted note
     */
    public static async insert(
        data: InferInsertModel<typeof Notes>,
        userRequestingNoteId?: string,
    ): Promise<Note> {
        const inserted = (await db.insert(Notes).values(data).returning())[0];

        const note = await Note.fromId(inserted.id, userRequestingNoteId);

        if (!note) {
            throw new Error("Failed to insert status");
        }

        // Update author's status count
        await note.author.recalculateStatusCount();

        if (note.data.replyId) {
            // Update the reply's reply count
            await new Note(
                note.data.reply as typeof Note.$type,
            ).recalculateReplyCount();
        }

        return note;
    }

    /**
     * Fetch a note from the database by its ID
     * @param id - The ID of the note to fetch
     * @param userRequestingNoteId - The ID of the user requesting the note (used to check visibility of the note)
     * @returns The fetched note
     */
    public static async fromId(
        id: string | null,
        userRequestingNoteId?: string,
    ): Promise<Note | null> {
        if (!id) {
            return null;
        }

        return await Note.fromSql(
            eq(Notes.id, id),
            undefined,
            userRequestingNoteId,
        );
    }
    /**
     * Fetch multiple notes from the database by their IDs
     * @param ids - The IDs of the notes to fetch
     * @param userRequestingNoteId - The ID of the user requesting the note (used to check visibility of the note)
     * @returns The fetched notes
     */
    public static async fromIds(
        ids: string[],
        userRequestingNoteId?: string,
    ): Promise<Note[]> {
        return await Note.manyFromSql(
            inArray(Notes.id, ids),
            undefined,
            undefined,
            undefined,
            userRequestingNoteId,
        );
    }

    /**
     * Fetch a note from the database by a SQL query
     * @param sql - The SQL query to fetch the note with
     * @param orderBy - The SQL query to order the results by
     * @param userId - The ID of the user requesting the note (used to check visibility of the note)
     * @returns The fetched note
     */
    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Notes.id),
        userId?: string,
    ): Promise<Note | null> {
        const found = await findManyNotes(
            {
                where: sql,
                orderBy,
                limit: 1,
            },
            userId,
        );

        if (!found[0]) {
            return null;
        }
        return new Note(found[0]);
    }

    /**
     * Fetch multiple notes from the database by a SQL query
     * @param sql - The SQL query to fetch the notes with
     * @param orderBy - The SQL query to order the results by
     * @param limit - The maximum number of notes to fetch
     * @param offset - The number of notes to skip
     * @param userId - The ID of the user requesting the note (used to check visibility of the note)
     * @returns - The fetched notes
     */
    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Notes.id),
        limit?: number,
        offset?: number,
        userId?: string,
    ): Promise<Note[]> {
        const found = await findManyNotes(
            {
                where: sql,
                orderBy,
                limit,
                offset,
            },
            userId,
        );

        return found.map((s) => new Note(s));
    }

    public get id(): string {
        return this.data.id;
    }

    public async federateToUsers(): Promise<void> {
        const users = await this.getUsersToFederateTo();

        await deliveryQueue.addBulk(
            users.map((user) => ({
                data: {
                    entity: this.toVersia().toJSON(),
                    recipientId: user.id,
                    senderId: this.author.id,
                },
                name: DeliveryJobType.FederateEntity,
            })),
        );
    }

    /**
     * Fetch the users that should be federated to for this note
     *
     * This includes:
     * - Users mentioned in the note
     * - Users that can see the note
     * @returns The users that should be federated to
     */
    public async getUsersToFederateTo(): Promise<User[]> {
        // Mentioned users
        const mentionedUsers =
            this.data.mentions.length > 0
                ? await User.manyFromSql(
                      and(
                          isNotNull(Users.instanceId),
                          inArray(
                              Users.id,
                              this.data.mentions.map((mention) => mention.id),
                          ),
                      ),
                  )
                : [];

        const usersThatCanSeePost = await User.manyFromSql(
            isNotNull(Users.instanceId),
            undefined,
            undefined,
            undefined,
            {
                with: {
                    relationships: {
                        where: (relationship): SQL | undefined =>
                            and(
                                eq(relationship.subjectId, this.data.authorId),
                                eq(relationship.following, true),
                            ),
                    },
                },
            },
        );

        const fusedUsers = mergeAndDeduplicate(
            mentionedUsers,
            usersThatCanSeePost,
        );

        return fusedUsers;
    }

    public get author(): User {
        return new User(this.data.author);
    }

    /**
     * Get the number of notes in the database (excluding remote notes)
     * @returns The number of notes in the database
     */
    public static async getCount(): Promise<number> {
        return await db.$count(
            Notes,
            sql`EXISTS (SELECT 1 FROM "Users" WHERE "Users"."id" = ${Notes.authorId} AND "Users"."instanceId" IS NULL)`,
        );
    }

    /**
     * Reblog a note.
     *
     * If the note is already reblogged, it will return the existing reblog. Also creates a notification for the author of the note.
     * @param reblogger The user reblogging the note
     * @param visibility The visibility of the reblog
     * @param uri The URI of the reblog, if it is remote
     * @returns The reblog object created or the existing reblog
     */
    public async reblog(
        reblogger: User,
        visibility: z.infer<typeof StatusSchema.shape.visibility>,
        uri?: URL,
    ): Promise<Note> {
        const existingReblog = await Note.fromSql(
            and(eq(Notes.authorId, reblogger.id), eq(Notes.reblogId, this.id)),
            undefined,
            reblogger.id,
        );

        if (existingReblog) {
            return existingReblog;
        }

        const newReblog = await Note.insert({
            id: randomUUIDv7(),
            authorId: reblogger.id,
            reblogId: this.id,
            visibility,
            sensitive: false,
            updatedAt: new Date().toISOString(),
            clientId: null,
            uri: uri?.href,
        });

        await this.recalculateReblogCount();

        // Refetch the note *again* to get the proper value of .reblogged
        await newReblog.reload(reblogger?.id);

        if (!newReblog) {
            throw new Error("Failed to reblog");
        }

        if (this.author.local) {
            // Notify the user that their post has been reblogged
            await this.author.notify("reblog", reblogger, newReblog);
        }

        if (reblogger.local) {
            const federatedUsers = await reblogger.federateToFollowers(
                newReblog.toVersiaShare(),
            );

            if (
                this.remote &&
                !federatedUsers.find((u) => u.id === this.author.id)
            ) {
                await reblogger.federateToUser(
                    newReblog.toVersiaShare(),
                    this.author,
                );
            }
        }

        return newReblog;
    }

    /**
     * Unreblog a note.
     *
     * If the note is not reblogged, it will return without doing anything. Also removes any notifications for this reblog.
     * @param unreblogger The user unreblogging the note
     * @returns
     */
    public async unreblog(unreblogger: User): Promise<void> {
        const reblogToDelete = await Note.fromSql(
            and(
                eq(Notes.authorId, unreblogger.id),
                eq(Notes.reblogId, this.id),
            ),
            undefined,
            unreblogger.id,
        );

        if (!reblogToDelete) {
            return;
        }

        await reblogToDelete.delete();

        await this.recalculateReblogCount();

        if (this.author.local) {
            // Remove any eventual notifications for this reblog
            await db
                .delete(Notifications)
                .where(
                    and(
                        eq(Notifications.accountId, this.id),
                        eq(Notifications.type, "reblog"),
                        eq(Notifications.notifiedId, unreblogger.id),
                        eq(Notifications.noteId, this.id),
                    ),
                );
        }

        if (this.local) {
            const federatedUsers = await unreblogger.federateToFollowers(
                reblogToDelete.toVersiaUnshare(),
            );

            if (
                this.remote &&
                !federatedUsers.find((u) => u.id === this.author.id)
            ) {
                await unreblogger.federateToUser(
                    reblogToDelete.toVersiaUnshare(),
                    this.author,
                );
            }
        }
    }

    /**
     * Like a note.
     *
     * If the note is already liked, it will return the existing like. Also creates a notification for the author of the note.
     * @param liker The user liking the note
     * @param uri The URI of the like, if it is remote
     * @returns The like object created or the existing like
     */
    public async like(liker: User, uri?: URL): Promise<Like> {
        // Check if the user has already liked the note
        const existingLike = await Like.fromSql(
            and(eq(Likes.likerId, liker.id), eq(Likes.likedId, this.id)),
        );

        if (existingLike) {
            return existingLike;
        }

        const newLike = await Like.insert({
            id: randomUUIDv7(),
            likerId: liker.id,
            likedId: this.id,
            uri: uri?.href,
        });

        await this.recalculateLikeCount();

        if (this.author.local) {
            // Notify the user that their post has been favourited
            await this.author.notify("favourite", liker, this);
        }

        if (liker.local) {
            const federatedUsers = await liker.federateToFollowers(
                newLike.toVersia(),
            );

            if (
                this.remote &&
                !federatedUsers.find((u) => u.id === this.author.id)
            ) {
                await liker.federateToUser(newLike.toVersia(), this.author);
            }
        }

        return newLike;
    }

    /**
     * Unlike a note.
     *
     * If the note is not liked, it will return without doing anything. Also removes any notifications for this like.
     * @param unliker The user unliking the note
     * @returns
     */
    public async unlike(unliker: User): Promise<void> {
        const likeToDelete = await Like.fromSql(
            and(eq(Likes.likerId, unliker.id), eq(Likes.likedId, this.id)),
        );

        if (!likeToDelete) {
            return;
        }

        await likeToDelete.delete();

        await this.recalculateLikeCount();

        if (this.author.local) {
            // Remove any eventual notifications for this like
            await likeToDelete.clearRelatedNotifications();
        }

        if (unliker.local) {
            const federatedUsers = await unliker.federateToFollowers(
                likeToDelete.unlikeToVersia(unliker),
            );

            if (
                this.remote &&
                !federatedUsers.find((u) => u.id === this.author.id)
            ) {
                await unliker.federateToUser(
                    likeToDelete.unlikeToVersia(unliker),
                    this.author,
                );
            }
        }
    }

    /**
     * Add an emoji reaction to a note
     * @param reacter - The author of the reaction
     * @param emoji - The emoji to react with (Emoji object for custom emojis, or Unicode emoji)
     * @returns The created reaction
     */
    public async react(reacter: User, emoji: Emoji | string): Promise<void> {
        const existingReaction = await Reaction.fromEmoji(emoji, reacter, this);

        if (existingReaction) {
            return; // Reaction already exists, don't create duplicate
        }

        // Create the reaction
        const reaction = await Reaction.insert({
            id: randomUUIDv7(),
            authorId: reacter.id,
            noteId: this.id,
            emojiText: emoji instanceof Emoji ? null : emoji,
            emojiId: emoji instanceof Emoji ? emoji.id : null,
        });

        await this.reload(reacter.id);

        if (this.author.local) {
            // Notify the user that their post has been reacted to
            await this.author.notify("reaction", reacter, this);
        }

        if (reacter.local) {
            const federatedUsers = await reacter.federateToFollowers(
                reaction.toVersia(),
            );

            if (
                this.remote &&
                !federatedUsers.find((u) => u.id === this.author.id)
            ) {
                await reacter.federateToUser(reaction.toVersia(), this.author);
            }
        }
    }

    /**
     * Remove an emoji reaction from a note
     * @param unreacter - The author of the reaction
     * @param emoji - The emoji to remove reaction for (Emoji object for custom emojis, or Unicode emoji)
     */
    public async unreact(
        unreacter: User,
        emoji: Emoji | string,
    ): Promise<void> {
        const reactionToDelete = await Reaction.fromEmoji(
            emoji,
            unreacter,
            this,
        );

        if (!reactionToDelete) {
            return; // Reaction doesn't exist, nothing to delete
        }

        await reactionToDelete.delete();

        if (this.author.local) {
            // Remove any eventual notifications for this reaction
            await db
                .delete(Notifications)
                .where(
                    and(
                        eq(Notifications.accountId, unreacter.id),
                        eq(Notifications.type, "reaction"),
                        eq(Notifications.notifiedId, this.data.authorId),
                        eq(Notifications.noteId, this.id),
                    ),
                );
        }

        if (unreacter.local) {
            const federatedUsers = await unreacter.federateToFollowers(
                reactionToDelete.toVersiaUnreact(),
            );

            if (
                this.remote &&
                !federatedUsers.find((u) => u.id === this.author.id)
            ) {
                await unreacter.federateToUser(
                    reactionToDelete.toVersiaUnreact(),
                    this.author,
                );
            }
        }
    }

    /**
     * Get the children of this note (replies)
     * @param userId - The ID of the user requesting the note (used to check visibility of the note)
     * @returns The children of this note
     */
    private async getReplyChildren(userId?: string): Promise<Note[]> {
        return await Note.manyFromSql(
            eq(Notes.replyId, this.data.id),
            undefined,
            undefined,
            undefined,
            userId,
        );
    }

    public get remote(): boolean {
        return this.author.remote;
    }

    public get local(): boolean {
        return this.author.local;
    }

    public async recalculateReblogCount(): Promise<void> {
        const reblogCount = await db.$count(Notes, eq(Notes.reblogId, this.id));

        await this.update({ reblogCount });
    }

    public async recalculateLikeCount(): Promise<void> {
        const likeCount = await db.$count(Likes, eq(Likes.likedId, this.id));

        await this.update({ likeCount });
    }

    public async recalculateReplyCount(): Promise<void> {
        const replyCount = await db.$count(Notes, eq(Notes.replyId, this.id));

        await this.update({ replyCount });
    }

    /**
     * Updates the emojis associated with this note in the database
     *
     * Deletes all existing emojis associated with this note, then replaces them with the provided emojis.
     * @param emojis - The emojis to associate with this note
     */
    public async updateEmojis(emojis: Emoji[]): Promise<void> {
        if (emojis.length === 0) {
            return;
        }

        // Connect emojis
        await db
            .delete(EmojiToNote)
            .where(eq(EmojiToNote.noteId, this.data.id));
        await db.insert(EmojiToNote).values(
            emojis.map((emoji) => ({
                emojiId: emoji.id,
                noteId: this.data.id,
            })),
        );
    }

    /**
     * Updates the mentions associated with this note in the database
     *
     * Deletes all existing mentions associated with this note, then replaces them with the provided mentions.
     * @param mentions - The mentions to associate with this note
     */
    public async updateMentions(mentions: User[]): Promise<void> {
        if (mentions.length === 0) {
            return;
        }

        // Connect mentions
        await db
            .delete(NoteToMentions)
            .where(eq(NoteToMentions.noteId, this.data.id));
        await db.insert(NoteToMentions).values(
            mentions.map((mention) => ({
                noteId: this.data.id,
                userId: mention.id,
            })),
        );
    }

    /**
     * Updates the attachments associated with this note in the database
     *
     * Deletes all existing attachments associated with this note, then replaces them with the provided attachments.
     * @param mediaAttachments - The IDs of the attachments to associate with this note
     */
    public async updateAttachments(mediaAttachments: Media[]): Promise<void> {
        if (mediaAttachments.length === 0) {
            return;
        }

        // Remove old attachments
        await db
            .delete(MediasToNotes)
            .where(eq(MediasToNotes.noteId, this.data.id));

        await db.insert(MediasToNotes).values(
            mediaAttachments.map((media) => ({
                noteId: this.data.id,
                mediaId: media.id,
            })),
        );
    }

    /**
     * Resolve a note from a URI
     * @param uri - The URI of the note to resolve
     * @returns The resolved note
     */
    public static async resolve(uri: URL): Promise<Note | null> {
        // Check if note not already in database
        const foundNote = await Note.fromSql(eq(Notes.uri, uri.href));

        if (foundNote) {
            return foundNote;
        }

        // Check if URI is of a local note
        if (uri.origin === config.http.base_url.origin) {
            const noteUuid = uri.pathname.match(uuid);

            if (!noteUuid?.[0]) {
                throw new Error(
                    `URI ${uri} is of a local note, but it could not be parsed`,
                );
            }

            return await Note.fromId(noteUuid[0]);
        }

        return Note.fromVersia(uri);
    }

    /**
     * Tries to fetch a Versia Note from the given URL.
     *
     * @param url The URL to fetch the note from
     */
    public static async fromVersia(url: URL): Promise<Note>;

    /**
     * Takes a Versia Note representation, and serializes it to the database.
     *
     * If the note already exists, it will update it.
     * @param versiaNote
     */
    public static async fromVersia(
        versiaNote: VersiaEntities.Note,
    ): Promise<Note>;

    public static async fromVersia(
        versiaNote: VersiaEntities.Note | URL,
    ): Promise<Note> {
        if (versiaNote instanceof URL) {
            // No bridge support for notes yet
            const note = await new FederationRequester(
                config.instance.keys.private,
                config.http.base_url,
            ).fetchEntity(versiaNote, VersiaEntities.Note);

            return Note.fromVersia(note);
        }

        const {
            author: authorUrl,
            created_at,
            uri,
            extensions,
            group,
            is_sensitive,
            mentions: noteMentions,
            quotes,
            replies_to,
            subject,
        } = versiaNote.data;
        const instance = await Instance.resolve(new URL(authorUrl));
        const author = await User.resolve(new URL(authorUrl));

        if (!author) {
            throw new Error("Entity author could not be resolved");
        }

        const existingNote = await Note.fromSql(eq(Notes.uri, uri));

        const note =
            existingNote ??
            (await Note.insert({
                id: randomUUIDv7(),
                authorId: author.id,
                visibility: "public",
                uri,
                createdAt: new Date(created_at).toISOString(),
            }));

        const attachments = await Promise.all(
            versiaNote.attachments.map((a) => Media.fromVersia(a)),
        );

        const emojis = await Promise.all(
            extensions?.["pub.versia:custom_emojis"]?.emojis
                .filter(
                    (e) =>
                        !config.validation.filters.emoji_shortcode.some(
                            (filter) => filter.test(e.name),
                        ),
                )
                .map((emoji) => Emoji.fetchFromRemote(emoji, instance)) ?? [],
        );

        const mentions = (
            await Promise.all(
                noteMentions?.map((mention) =>
                    User.resolve(new URL(mention)),
                ) ?? [],
            )
        ).filter((m) => m !== null);

        // TODO: Implement groups
        const visibility =
            !group || URL.canParse(group)
                ? "direct"
                : (group as "public" | "followers" | "unlisted");

        const reply = replies_to
            ? await Note.resolve(new URL(replies_to))
            : null;
        const quote = quotes ? await Note.resolve(new URL(quotes)) : null;
        const spoiler = subject ? await sanitizedHtmlStrip(subject) : undefined;

        await note.update({
            content: versiaNote.content
                ? await versiaTextToHtml(versiaNote.content, mentions)
                : undefined,
            contentSource: versiaNote.content
                ? versiaNote.content.data["text/plain"]?.content ||
                  versiaNote.content.data["text/markdown"]?.content
                : undefined,
            contentType: "text/html",
            visibility: visibility === "followers" ? "private" : visibility,
            sensitive: is_sensitive ?? false,
            spoilerText: spoiler,
            replyId: reply?.id,
            quotingId: quote?.id,
        });

        // Emojis, mentions, and attachments are stored in a different table, so update them there too
        await note.updateEmojis(emojis);
        await note.updateMentions(mentions);
        await note.updateAttachments(attachments);

        await note.reload(author.id);

        // Send notifications for mentioned local users
        for (const mentioned of mentions) {
            if (mentioned.local) {
                await mentioned.notify("mention", author, note);
            }
        }

        return note;
    }

    public async delete(): Promise<void> {
        await db.delete(Notes).where(eq(Notes.id, this.id));

        // Update author's status count
        await this.author.recalculateStatusCount();
    }

    public async update(
        newStatus: Partial<NoteTypeWithRelations>,
    ): Promise<NoteTypeWithRelations> {
        await db.update(Notes).set(newStatus).where(eq(Notes.id, this.data.id));

        const updated = await Note.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update status");
        }

        return updated.data;
    }

    /**
     * Returns whether this status is viewable by a user.
     * @param user The user to check.
     * @returns Whether this status is viewable by the user.
     */
    public async isViewableByUser(user: User | null): Promise<boolean> {
        if (this.author.id === user?.id) {
            return true;
        }
        if (this.data.visibility === "public") {
            return true;
        }
        if (this.data.visibility === "unlisted") {
            return true;
        }
        if (this.data.visibility === "private") {
            return user
                ? !!(await db.query.Relationships.findFirst({
                      where: (relationship): SQL | undefined =>
                          and(
                              eq(relationship.ownerId, user?.id),
                              eq(relationship.subjectId, Notes.authorId),
                              eq(relationship.following, true),
                          ),
                  }))
                : false;
        }
        return (
            !!user &&
            !!this.data.mentions.find((mention) => mention.id === user.id)
        );
    }

    /**
     * Convert a note to the Mastodon API format
     * @param userFetching - The user fetching the note (used to check if the note is favourite and such)
     * @returns The note in the Mastodon API format
     */
    public async toApi(
        userFetching?: User | null,
    ): Promise<z.infer<typeof StatusSchema>> {
        const data = this.data;

        // Convert mentions of local users from @username@host to @username
        const mentionedLocalUsers = data.mentions.filter(
            (mention) => mention.instanceId === null,
        );

        let replacedContent = data.content;

        for (const mention of mentionedLocalUsers) {
            replacedContent = replacedContent.replace(
                createRegExp(
                    exactly(
                        `@${mention.username}@${config.http.base_url.host}`,
                    ),
                    [global],
                ),
                `@${mention.username}`,
            );
        }

        const reactions = this.getReactions(userFetching ?? undefined).map(
            // Remove account_ids
            (r) => ({
                ...r,
                account_ids: undefined,
            }),
        );

        const emojis = data.emojis.concat(
            data.reactions.map((r) => r.emoji).filter((v) => v !== null),
        );

        return {
            id: data.id,
            in_reply_to_id: data.replyId || null,
            in_reply_to_account_id: data.reply?.authorId || null,
            account: this.author.toApi(userFetching?.id === data.authorId),
            created_at: new Date(data.createdAt).toISOString(),
            application: data.client
                ? new Client(data.client).toApi()
                : undefined,
            card: null,
            content: replacedContent,
            emojis: emojis.map((emoji) => new Emoji(emoji).toApi()),
            favourited: data.liked,
            favourites_count: data.likeCount,
            media_attachments: (data.attachments ?? []).map((a) =>
                new Media(a).toApi(),
            ),
            mentions: data.mentions.map((mention) => ({
                id: mention.id,
                acct: User.getAcct(
                    mention.instanceId === null,
                    mention.username,
                    mention.instance?.baseUrl,
                ),
                url: User.getUri(
                    mention.id,
                    mention.uri ? new URL(mention.uri) : null,
                ).toString(),
                username: mention.username,
            })),
            language: null,
            muted: data.muted,
            pinned: data.pinned,
            // TODO: Add polls
            poll: null,
            reblog: data.reblog
                ? await new Note(data.reblog as NoteTypeWithRelations).toApi(
                      userFetching,
                  )
                : null,
            reblogged: data.reblogged,
            reblogs_count: data.reblogCount,
            replies_count: data.replyCount,
            sensitive: data.sensitive,
            spoiler_text: data.spoilerText,
            tags: [],
            uri: data.uri || this.getUri().toString(),
            visibility: data.visibility,
            url: data.uri || this.getMastoUri().toString(),
            bookmarked: false,
            quote: data.quotingId
                ? ((await Note.fromId(data.quotingId, userFetching?.id).then(
                      (n) => n?.toApi(userFetching),
                  )) ?? null)
                : null,
            edited_at: data.updatedAt
                ? new Date(data.updatedAt).toISOString()
                : null,
            reactions,
            text: data.contentSource,
        };
    }

    public getUri(): URL {
        return this.data.uri
            ? new URL(this.data.uri)
            : new URL(`/notes/${this.id}`, config.http.base_url);
    }

    /**
     * Get the frontend URI of this note
     * @returns The frontend URI of this note
     */
    public getMastoUri(): URL {
        return new URL(
            `/@${this.author.data.username}/${this.id}`,
            config.http.base_url,
        );
    }

    public deleteToVersia(): VersiaEntities.Delete {
        const id = crypto.randomUUID();

        return new VersiaEntities.Delete({
            type: "Delete",
            id,
            author: this.author.uri.href,
            deleted_type: "Note",
            deleted: this.getUri().href,
            created_at: new Date().toISOString(),
        });
    }

    /**
     * Convert a note to the Versia format
     * @returns The note in the Versia format
     */
    public toVersia(): VersiaEntities.Note {
        const status = this.data;
        return new VersiaEntities.Note({
            type: "Note",
            created_at: new Date(status.createdAt).toISOString(),
            id: status.id,
            author: this.author.uri.href,
            uri: this.getUri().href,
            content: {
                "text/html": {
                    content: status.content,
                    remote: false,
                },
                "text/plain": {
                    content: htmlToText(status.content),
                    remote: false,
                },
            },
            collections: {
                replies: new URL(
                    `/notes/${status.id}/replies`,
                    config.http.base_url,
                ).href,
                quotes: new URL(
                    `/notes/${status.id}/quotes`,
                    config.http.base_url,
                ).href,
                "pub.versia:share/Shares": new URL(
                    `/notes/${status.id}/shares`,
                    config.http.base_url,
                ).href,
            },
            attachments: status.attachments.map(
                (attachment) =>
                    new Media(attachment).toVersia().data as z.infer<
                        typeof NonTextContentFormatSchema
                    >,
            ),
            is_sensitive: status.sensitive,
            mentions: status.mentions.map(
                (mention) =>
                    User.getUri(
                        mention.id,
                        mention.uri ? new URL(mention.uri) : null,
                    ).href,
            ),
            quotes: status.quote
                ? status.quote.uri
                    ? new URL(status.quote.uri).href
                    : new URL(`/notes/${status.quote.id}`, config.http.base_url)
                          .href
                : null,
            replies_to: status.reply
                ? status.reply.uri
                    ? new URL(status.reply.uri).href
                    : new URL(`/notes/${status.reply.id}`, config.http.base_url)
                          .href
                : null,
            subject: status.spoilerText,
            // TODO: Refactor as part of groups
            group: status.visibility === "public" ? "public" : "followers",
            extensions: {
                "pub.versia:custom_emojis": {
                    emojis: status.emojis.map((emoji) =>
                        new Emoji(emoji).toVersia(),
                    ),
                },
                // TODO: Add polls and reactions
            },
        });
    }

    public toVersiaShare(): VersiaEntities.Share {
        if (!(this.data.reblogId && this.data.reblog)) {
            throw new Error("Cannot share a non-reblogged note");
        }

        return new VersiaEntities.Share({
            type: "pub.versia:share/Share",
            id: crypto.randomUUID(),
            author: this.author.uri.href,
            uri: new URL(`/shares/${this.id}`, config.http.base_url).href,
            created_at: new Date().toISOString(),
            shared: new Note(this.data.reblog as NoteTypeWithRelations).getUri()
                .href,
        });
    }

    public toVersiaUnshare(): VersiaEntities.Delete {
        return new VersiaEntities.Delete({
            type: "Delete",
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            author: User.getUri(
                this.data.authorId,
                this.data.author.uri ? new URL(this.data.author.uri) : null,
            ).href,
            deleted_type: "pub.versia:share/Share",
            deleted: new URL(`/shares/${this.id}`, config.http.base_url).href,
        });
    }

    /**
     * Return all the ancestors of this post,
     * i.e. all the posts that this post is a reply to
     * @param fetcher - The user fetching the ancestors
     * @returns The ancestors of this post
     */
    public async getAncestors(fetcher: User | null): Promise<Note[]> {
        const ancestors: Note[] = [];

        let currentStatus: Note = this;

        while (currentStatus.data.replyId) {
            const parent = await Note.fromId(
                currentStatus.data.replyId,
                fetcher?.id,
            );

            if (!parent) {
                break;
            }

            ancestors.push(parent);
            currentStatus = parent;
        }

        // Filter for posts that are viewable by the user
        const viewableAncestors = await Promise.all(
            ancestors.map(async (ancestor) => {
                const isViewable = await ancestor.isViewableByUser(fetcher);
                return isViewable ? ancestor : null;
            }),
        ).then((filteredAncestors) =>
            filteredAncestors.filter((n) => n !== null),
        );

        // Reverse the order so that the oldest posts are first
        return viewableAncestors.toReversed();
    }

    /**
     * Return all the descendants of this post (recursive)
     * Temporary implementation, will be replaced with a recursive SQL query when I get to it
     * @param fetcher - The user fetching the descendants
     * @param depth - The depth of the recursion (internal)
     * @returns The descendants of this post
     */
    public async getDescendants(
        fetcher: User | null,
        depth = 0,
    ): Promise<Note[]> {
        const descendants: Note[] = [];
        for (const child of await this.getReplyChildren(fetcher?.id)) {
            descendants.push(child);

            if (depth < 20) {
                const childDescendants = await child.getDescendants(
                    fetcher,
                    depth + 1,
                );
                descendants.push(...childDescendants);
            }
        }

        // Filter for posts that are viewable by the user

        const viewableDescendants = await Promise.all(
            descendants.map(async (descendant) => {
                const isViewable = await descendant.isViewableByUser(fetcher);
                return isViewable ? descendant : null;
            }),
        ).then((filteredDescendants) =>
            filteredDescendants.filter((n) => n !== null),
        );

        return viewableDescendants;
    }

    /**
     * Get reactions for this note grouped by emoji name
     * @param user - The user requesting reactions (to determine 'me' field)
     * @returns Array of reactions grouped by emoji name with counts and account IDs
     */
    public getReactions(
        user?: User,
    ): z.infer<typeof NoteReactionWithAccounts>[] {
        // Group reactions by emoji name (either emojiText for Unicode or formatted shortcode for custom)
        const groupedReactions = new Map<
            string,
            {
                count: number;
                me: boolean;
                instance: typeof Instance.$type | null;
                account_ids: string[];
            }
        >();

        for (const reaction of this.data.reactions) {
            let emojiName: string;

            // Determine emoji name based on type
            if (reaction.emojiText) {
                emojiName = reaction.emojiText;
            } else if (reaction.emoji?.instance === null) {
                emojiName = `:${reaction.emoji.shortcode}:`;
            } else if (reaction.emoji?.instance) {
                emojiName = `:${reaction.emoji.shortcode}@${reaction.emoji.instance.baseUrl}:`;
            } else {
                continue; // Skip invalid reactions
            }

            // Initialize group if it doesn't exist
            if (!groupedReactions.has(emojiName)) {
                groupedReactions.set(emojiName, {
                    count: 0,
                    me: false,
                    account_ids: [],
                    instance: reaction.emoji?.instance ?? null,
                });
            }

            const group = groupedReactions.get(emojiName);

            if (!group) {
                continue;
            }

            group.count += 1;
            group.account_ids.push(reaction.authorId);

            // Check if current user reacted with this emoji
            if (user && reaction.authorId === user.id) {
                group.me = true;
            }
        }

        // Convert map to array format
        return Array.from(groupedReactions.entries()).map(([name, data]) => ({
            name,
            count: data.count,
            me: data.me,
            account_ids: data.account_ids,
            remote: data.instance !== null,
        }));
    }
}
