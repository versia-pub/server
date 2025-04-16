import type { Status } from "@versia/client/schemas";
import { db, Instance } from "@versia/kit/db";
import {
    EmojiToNote,
    MediasToNotes,
    Notes,
    NoteToMentions,
    Users,
} from "@versia/kit/tables";
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
import type { z } from "zod";
import { idValidator } from "@/api";
import { mergeAndDeduplicate } from "@/lib.ts";
import { sanitizedHtmlStrip } from "@/sanitization";
import { contentToHtml, findManyNotes } from "~/classes/functions/status";
import { config } from "~/config.ts";
import * as VersiaEntities from "~/packages/sdk/entities/index.ts";
import type { NonTextContentFormatSchema } from "~/packages/sdk/schemas/contentformat.ts";
import { DeliveryJobType, deliveryQueue } from "../queues/delivery.ts";
import { Application } from "./application.ts";
import { BaseInterface } from "./base.ts";
import { Emoji } from "./emoji.ts";
import { Media } from "./media.ts";
import { User } from "./user.ts";

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
    application: typeof Application.$type | null;
    reblogCount: number;
    likeCount: number;
    replyCount: number;
    pinned: boolean;
    reblogged: boolean;
    muted: boolean;
    liked: boolean;
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
                        where: (relationship, { eq, and }): SQL | undefined =>
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
            const uuid = uri.pathname.match(idValidator);

            if (!uuid?.[0]) {
                throw new Error(
                    `URI ${uri} is of a local note, but it could not be parsed`,
                );
            }

            return await Note.fromId(uuid[0]);
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
            const note = await User.federationRequester.fetchEntity(
                versiaNote,
                VersiaEntities.Note,
            );

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
            extensions?.["pub.versia:custom_emojis"]?.emojis.map((emoji) =>
                Emoji.fetchFromRemote(emoji, instance),
            ) ?? [],
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
                ? await contentToHtml(versiaNote.content, mentions)
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

    public async delete(ids?: string[]): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Notes).where(inArray(Notes.id, ids));
        } else {
            await db.delete(Notes).where(eq(Notes.id, this.id));
        }
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
                      where: (relationship, { and, eq }): SQL | undefined =>
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
    ): Promise<z.infer<typeof Status>> {
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

        return {
            id: data.id,
            in_reply_to_id: data.replyId || null,
            in_reply_to_account_id: data.reply?.authorId || null,
            account: this.author.toApi(userFetching?.id === data.authorId),
            created_at: new Date(data.createdAt).toISOString(),
            application: data.application
                ? new Application(data.application).toApi()
                : undefined,
            card: null,
            content: replacedContent,
            emojis: data.emojis.map((emoji) => new Emoji(emoji).toApi()),
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
            reactions: [],
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
}
