import { idValidator } from "@/api";
import { localObjectUri } from "@/constants";
import { mergeAndDeduplicate } from "@/lib.ts";
import { sanitizedHtmlStrip } from "@/sanitization";
import { sentry } from "@/sentry";
import { getLogger } from "@logtape/logtape";
import type {
    Attachment as ApiAttachment,
    Status as ApiStatus,
} from "@versia/client/types";
import { EntityValidator } from "@versia/federation";
import type {
    ContentFormat,
    Delete as VersiaDelete,
    Note as VersiaNote,
} from "@versia/federation/types";
import { Instance, db } from "@versia/kit/db";
import {
    EmojiToNote,
    MediasToNotes,
    NoteToMentions,
    Notes,
    Users,
} from "@versia/kit/tables";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    and,
    desc,
    eq,
    inArray,
    isNotNull,
    sql,
} from "drizzle-orm";
import { htmlToText } from "html-to-text";
import { createRegExp, exactly, global } from "magic-regexp";
import { z } from "zod";
import {
    contentToHtml,
    findManyNotes,
    parseTextMentions,
} from "~/classes/functions/status";
import { config } from "~/packages/config-manager";
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
    public static schema: z.ZodType<ApiStatus> = z.object({
        id: z.string().uuid(),
        uri: z.string().url(),
        url: z.string().url(),
        account: z.lazy(() => User.schema),
        in_reply_to_id: z.string().uuid().nullable(),
        in_reply_to_account_id: z.string().uuid().nullable(),
        reblog: z.lazy(() => Note.schema).nullable(),
        content: z.string(),
        plain_content: z.string().nullable(),
        created_at: z.string(),
        edited_at: z.string().nullable(),
        emojis: z.array(Emoji.schema),
        replies_count: z.number().int().nonnegative(),
        reblogs_count: z.number().int().nonnegative(),
        favourites_count: z.number().int().nonnegative(),
        reblogged: z.boolean().nullable(),
        favourited: z.boolean().nullable(),
        muted: z.boolean().nullable(),
        sensitive: z.boolean(),
        spoiler_text: z.string(),
        visibility: z.enum(["public", "unlisted", "private", "direct"]),
        media_attachments: z.array(Media.schema),
        mentions: z.array(
            z.object({
                id: z.string().uuid(),
                username: z.string(),
                acct: z.string(),
                url: z.string().url(),
            }),
        ),
        tags: z.array(z.object({ name: z.string(), url: z.string().url() })),
        card: z
            .object({
                url: z.string().url(),
                title: z.string(),
                description: z.string(),
                type: z.enum(["link", "photo", "video", "rich"]),
                image: z.string().url().nullable(),
                author_name: z.string().nullable(),
                author_url: z.string().url().nullable(),
                provider_name: z.string().nullable(),
                provider_url: z.string().url().nullable(),
                html: z.string().nullable(),
                width: z.number().int().nonnegative().nullable(),
                height: z.number().int().nonnegative().nullable(),
                embed_url: z.string().url().nullable(),
                blurhash: z.string().nullable(),
            })
            .nullable(),
        poll: z
            .object({
                id: z.string().uuid(),
                expires_at: z.string(),
                expired: z.boolean(),
                multiple: z.boolean(),
                votes_count: z.number().int().nonnegative(),
                voted: z.boolean(),
                options: z.array(
                    z.object({
                        title: z.string(),
                        votes_count: z.number().int().nonnegative().nullable(),
                    }),
                ),
            })
            .nullable(),
        application: z
            .object({
                name: z.string(),
                website: z.string().url().nullable().optional(),
                vapid_key: z.string().nullable().optional(),
            })
            .nullable(),
        language: z.string().nullable(),
        pinned: z.boolean().nullable(),
        emoji_reactions: z.array(
            z.object({
                count: z.number().int().nonnegative(),
                me: z.boolean(),
                name: z.string(),
                url: z.string().url().optional(),
                static_url: z.string().url().optional(),
                accounts: z.array(z.lazy(() => User.schema)).optional(),
                account_ids: z.array(z.string().uuid()).optional(),
            }),
        ),
        quote: z.lazy(() => Note.schema).nullable(),
        bookmarked: z.boolean(),
    });

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
                    entity: this.toVersia(),
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

    public isRemote(): boolean {
        return this.author.isRemote();
    }

    /**
     * Update a note from remote federated servers
     * @returns The updated note
     */
    public async updateFromRemote(): Promise<Note> {
        if (!this.isRemote()) {
            throw new Error("Cannot refetch a local note (it is not remote)");
        }

        const updated = await Note.fetchFromRemote(this.getUri());

        if (!updated) {
            throw new Error("Note not found after update");
        }

        this.data = updated.data;

        return this;
    }

    /**
     * Create a new note from user input
     * @param data - The data to create the note from
     * @returns The created note
     */
    public static async fromData(data: {
        author: User;
        content: ContentFormat;
        visibility: ApiStatus["visibility"];
        isSensitive: boolean;
        spoilerText: string;
        emojis?: Emoji[];
        uri?: string;
        mentions?: User[];
        /** List of IDs of database Attachment objects */
        mediaAttachments?: Media[];
        replyId?: string;
        quoteId?: string;
        application?: Application;
    }): Promise<Note> {
        const plaintextContent =
            data.content["text/plain"]?.content ??
            Object.entries(data.content)[0][1].content;

        const parsedMentions = mergeAndDeduplicate(
            data.mentions ?? [],
            await parseTextMentions(plaintextContent, data.author),
        );
        const parsedEmojis = mergeAndDeduplicate(
            data.emojis ?? [],
            await Emoji.parseFromText(plaintextContent),
        );

        const htmlContent = await contentToHtml(data.content, parsedMentions);

        const newNote = await Note.insert({
            authorId: data.author.id,
            content: htmlContent,
            contentSource:
                data.content["text/plain"]?.content ||
                data.content["text/markdown"]?.content ||
                Object.entries(data.content)[0][1].content ||
                "",
            contentType: "text/html",
            visibility: data.visibility,
            sensitive: data.isSensitive,
            spoilerText: await sanitizedHtmlStrip(data.spoilerText),
            uri: data.uri || null,
            replyId: data.replyId ?? null,
            quotingId: data.quoteId ?? null,
            applicationId: data.application?.id ?? null,
        });

        // Connect emojis
        await newNote.updateEmojis(parsedEmojis);

        // Connect mentions
        await newNote.updateMentions(parsedMentions);

        // Set attachment parents
        await newNote.updateAttachments(data.mediaAttachments ?? []);

        // Send notifications for mentioned local users
        for (const mention of parsedMentions) {
            if (mention.isLocal()) {
                await mention.notify("mention", data.author, newNote);
            }
        }

        await newNote.reload(data.author.id);

        return newNote;
    }

    /**
     * Update a note from user input
     * @param data - The data to update the note from
     * @returns The updated note
     */
    public async updateFromData(data: {
        author: User;
        content?: ContentFormat;
        visibility?: ApiStatus["visibility"];
        isSensitive?: boolean;
        spoilerText?: string;
        emojis?: Emoji[];
        uri?: string;
        mentions?: User[];
        mediaAttachments?: Media[];
        replyId?: string;
        quoteId?: string;
        application?: Application;
    }): Promise<Note> {
        const plaintextContent = data.content
            ? (data.content["text/plain"]?.content ??
              Object.entries(data.content)[0][1].content)
            : undefined;

        const parsedMentions = mergeAndDeduplicate(
            data.mentions ?? [],
            plaintextContent
                ? await parseTextMentions(plaintextContent, data.author)
                : [],
        );
        const parsedEmojis = mergeAndDeduplicate(
            data.emojis ?? [],
            plaintextContent ? await Emoji.parseFromText(plaintextContent) : [],
        );

        const htmlContent = data.content
            ? await contentToHtml(data.content, parsedMentions)
            : undefined;

        await this.update({
            content: htmlContent,
            contentSource: data.content
                ? data.content["text/plain"]?.content ||
                  data.content["text/markdown"]?.content ||
                  Object.entries(data.content)[0][1].content ||
                  ""
                : undefined,
            contentType: "text/html",
            visibility: data.visibility,
            sensitive: data.isSensitive,
            spoilerText: data.spoilerText,
            replyId: data.replyId,
            quotingId: data.quoteId,
            applicationId: data.application?.id,
        });

        // Connect emojis
        await this.updateEmojis(parsedEmojis);

        // Connect mentions
        await this.updateMentions(parsedMentions);

        // Set attachment parents
        await this.updateAttachments(data.mediaAttachments ?? []);

        await this.reload(data.author.id);

        return this;
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
    public static async resolve(uri: string): Promise<Note | null> {
        // Check if note not already in database
        const foundNote = await Note.fromSql(eq(Notes.uri, uri));

        if (foundNote) {
            return foundNote;
        }

        // Check if URI is of a local note
        if (uri.startsWith(config.http.base_url)) {
            const uuid = uri.match(idValidator);

            if (!uuid?.[0]) {
                throw new Error(
                    `URI ${uri} is of a local note, but it could not be parsed`,
                );
            }

            return await Note.fromId(uuid[0]);
        }

        return await Note.fetchFromRemote(uri);
    }

    /**
     * Save a note from a remote server
     * @param uri - The URI of the note to save
     * @returns The saved note, or null if the note could not be fetched
     */
    public static async fetchFromRemote(uri: string): Promise<Note | null> {
        const instance = await Instance.resolve(uri);

        if (!instance) {
            return null;
        }

        const requester = await User.getFederationRequester();

        const { data } = await requester.get(uri, {
            // @ts-expect-error Bun extension
            proxy: config.http.proxy.address,
        });

        const note = await new EntityValidator().Note(data);

        const author = await User.resolve(note.author);

        if (!author) {
            throw new Error("Invalid object author");
        }

        return await Note.fromVersia(note, author, instance);
    }

    /**
     * Turns a Versia Note into a database note (saved)
     * @param note Versia Note
     * @param author Author of the note
     * @param instance Instance of the note
     * @returns The saved note
     */
    public static async fromVersia(
        note: VersiaNote,
        author: User,
        instance: Instance,
    ): Promise<Note> {
        const emojis: Emoji[] = [];
        const logger = getLogger(["federation", "resolvers"]);

        for (const emoji of note.extensions?.["pub.versia:custom_emojis"]
            ?.emojis ?? []) {
            const resolvedEmoji = await Emoji.fetchFromRemote(
                emoji,
                instance,
            ).catch((e) => {
                logger.error`${e}`;
                sentry?.captureException(e);
                return null;
            });

            if (resolvedEmoji) {
                emojis.push(resolvedEmoji);
            }
        }

        const attachments: Media[] = [];

        for (const attachment of note.attachments ?? []) {
            const resolvedAttachment = await Media.fromVersia(attachment).catch(
                (e) => {
                    logger.error`${e}`;
                    sentry?.captureException(e);
                    return null;
                },
            );

            if (resolvedAttachment) {
                attachments.push(resolvedAttachment);
            }
        }

        let visibility = note.group
            ? ["public", "followers"].includes(note.group)
                ? (note.group as "public" | "private")
                : ("url" as const)
            : ("direct" as const);

        if (visibility === "url") {
            // TODO: Implement groups
            visibility = "direct";
        }

        const newData = {
            author,
            content: note.content ?? {
                "text/plain": {
                    content: "",
                    remote: false,
                },
            },
            visibility: visibility as ApiStatus["visibility"],
            isSensitive: note.is_sensitive ?? false,
            spoilerText: note.subject ?? "",
            emojis,
            uri: note.uri,
            mentions: await Promise.all(
                (note.mentions ?? [])
                    .map((mention) => User.resolve(mention))
                    .filter((mention) => mention !== null) as Promise<User>[],
            ),
            mediaAttachments: attachments,
            replyId: note.replies_to
                ? (await Note.resolve(note.replies_to))?.data.id
                : undefined,
            quoteId: note.quotes
                ? (await Note.resolve(note.quotes))?.data.id
                : undefined,
        };

        // Check if new note already exists

        const foundNote = await Note.fromSql(eq(Notes.uri, note.uri));

        // If it exists, simply update it
        if (foundNote) {
            await foundNote.updateFromData(newData);

            return foundNote;
        }

        // Else, create a new note
        return await Note.fromData(newData);
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
    public async toApi(userFetching?: User | null): Promise<ApiStatus> {
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
                        `@${mention.username}@${
                            new URL(config.http.base_url).host
                        }`,
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
                : null,
            card: null,
            content: replacedContent,
            emojis: data.emojis.map((emoji) => new Emoji(emoji).toApi()),
            favourited: data.liked,
            favourites_count: data.likeCount,
            media_attachments: (data.attachments ?? []).map(
                (a) => new Media(a).toApi() as ApiAttachment,
            ),
            mentions: data.mentions.map((mention) => ({
                id: mention.id,
                acct: User.getAcct(
                    mention.instanceId === null,
                    mention.username,
                    mention.instance?.baseUrl,
                ),
                url: User.getUri(mention.id, mention.uri, config.http.base_url),
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
            uri: data.uri || this.getUri(),
            visibility: data.visibility as ApiStatus["visibility"],
            url: data.uri || this.getMastoUri(),
            bookmarked: false,
            quote: data.quotingId
                ? ((await Note.fromId(data.quotingId, userFetching?.id).then(
                      (n) => n?.toApi(userFetching),
                  )) ?? null)
                : null,
            edited_at: data.updatedAt
                ? new Date(data.updatedAt).toISOString()
                : null,
            emoji_reactions: [],
            plain_content: data.contentSource,
        };
    }

    public getUri(): string {
        return this.data.uri || localObjectUri(this.id);
    }

    public static getUri(
        id: string | null,
        uri?: string | null,
    ): string | null {
        if (!id) {
            return null;
        }
        return uri || localObjectUri(id);
    }

    /**
     * Get the frontend URI of this note
     * @returns The frontend URI of this note
     */
    public getMastoUri(): string {
        return new URL(
            `/@${this.author.data.username}/${this.id}`,
            config.http.base_url,
        ).toString();
    }

    public deleteToVersia(): VersiaDelete {
        const id = crypto.randomUUID();

        return {
            type: "Delete",
            id,
            author: this.author.getUri(),
            deleted_type: "Note",
            deleted: this.getUri(),
            created_at: new Date().toISOString(),
        };
    }

    /**
     * Convert a note to the Versia format
     * @returns The note in the Versia format
     */
    public toVersia(): VersiaNote {
        const status = this.data;
        return {
            type: "Note",
            created_at: new Date(status.createdAt).toISOString(),
            id: status.id,
            author: this.author.getUri(),
            uri: this.getUri(),
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
            attachments: (status.attachments ?? []).map((attachment) =>
                new Media(attachment).toVersia(),
            ),
            is_sensitive: status.sensitive,
            mentions: status.mentions.map((mention) =>
                User.getUri(mention.id, mention.uri, config.http.base_url),
            ),
            quotes:
                Note.getUri(status.quotingId, status.quote?.uri) ?? undefined,
            replies_to:
                Note.getUri(status.replyId, status.reply?.uri) ?? undefined,
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
        };
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
