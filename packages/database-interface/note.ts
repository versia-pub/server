import { idValidator } from "@/api";
import { localObjectUri } from "@/constants";
import { proxyUrl } from "@/response";
import { sanitizedHtmlStrip } from "@/sanitization";
import { sentry } from "@/sentry";
import { getLogger } from "@logtape/logtape";
import type {
    Attachment as ApiAttachment,
    Status as ApiStatus,
} from "@lysand-org/client/types";
import { EntityValidator } from "@lysand-org/federation";
import type {
    ContentFormat,
    Note as LysandNote,
} from "@lysand-org/federation/types";
import {
    type InferInsertModel,
    type SQL,
    and,
    count,
    desc,
    eq,
    inArray,
    isNotNull,
    sql,
} from "drizzle-orm";
import { htmlToText } from "html-to-text";
import { createRegExp, exactly, global } from "magic-regexp";
import {
    type Application,
    applicationToApi,
} from "~/classes/functions/application";
import {
    type StatusWithRelations,
    contentToHtml,
    findManyNotes,
    parseTextMentions,
} from "~/classes/functions/status";
import { db } from "~/drizzle/db";
import {
    Attachments,
    EmojiToNote,
    NoteToMentions,
    Notes,
    Notifications,
    Users,
} from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { Attachment } from "./attachment";
import { BaseInterface } from "./base";
import { Emoji } from "./emoji";
import { User } from "./user";

/**
 * Gives helpers to fetch notes from database in a nice format
 */
export class Note extends BaseInterface<typeof Notes, StatusWithRelations> {
    save(): Promise<StatusWithRelations> {
        return this.update(this.data);
    }

    async reload(): Promise<void> {
        const reloaded = await Note.fromId(this.data.id);

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
    static async fromId(
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
    static async fromIds(
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
    static async fromSql(
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
    static async manyFromSql(
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

    get id() {
        return this.data.id;
    }

    async federateToUsers(): Promise<void> {
        const users = await this.getUsersToFederateTo();

        for (const user of users) {
            await this.author.federateToUser(this.toLysand(), user);
        }
    }

    /**
     * Fetch the users that should be federated to for this note
     *
     * This includes:
     * - Users mentioned in the note
     * - Users that can see the note
     * @returns The users that should be federated to
     */
    async getUsersToFederateTo(): Promise<User[]> {
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
                        where: (relationship, { eq, and }) =>
                            and(
                                eq(relationship.subjectId, this.data.authorId),
                                eq(relationship.following, true),
                            ),
                    },
                },
            },
        );

        const fusedUsers = [...mentionedUsers, ...usersThatCanSeePost];

        const deduplicatedUsersById = fusedUsers.filter(
            (user, index, self) =>
                index === self.findIndex((t) => t.id === user.id),
        );

        return deduplicatedUsersById;
    }

    get author() {
        return new User(this.data.author);
    }

    /**
     * Get the number of notes in the database (excluding remote notes)
     * @returns The number of notes in the database
     */
    static async getCount(): Promise<number> {
        return (
            await db
                .select({
                    count: count(),
                })
                .from(Notes)
                .where(
                    sql`EXISTS (SELECT 1 FROM "Users" WHERE "Users"."id" = ${Notes.authorId} AND "Users"."instanceId" IS NULL)`,
                )
        )[0].count;
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

    isRemote() {
        return this.author.isRemote();
    }

    /**
     * Update a note from remote federated servers
     * @returns The updated note
     */
    async updateFromRemote(): Promise<Note> {
        if (!this.isRemote()) {
            throw new Error("Cannot refetch a local note (it is not remote)");
        }

        const updated = await Note.saveFromRemote(this.getUri());

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
    static async fromData(data: {
        author: User;
        content: ContentFormat;
        visibility: ApiStatus["visibility"];
        isSensitive: boolean;
        spoilerText: string;
        emojis?: Emoji[];
        uri?: string;
        mentions?: User[];
        /** List of IDs of database Attachment objects */
        mediaAttachments?: string[];
        replyId?: string;
        quoteId?: string;
        application?: Application;
    }): Promise<Note> {
        const plaintextContent =
            data.content["text/plain"]?.content ??
            Object.entries(data.content)[0][1].content;

        const parsedMentions = [
            ...(data.mentions ?? []),
            ...(await parseTextMentions(plaintextContent, data.author)),
            // Deduplicate by .id
        ].filter(
            (mention, index, self) =>
                index === self.findIndex((t) => t.id === mention.id),
        );

        const parsedEmojis = [
            ...(data.emojis ?? []),
            ...(await Emoji.parseFromText(plaintextContent)),
            // Deduplicate by .id
        ].filter(
            (emoji, index, self) =>
                index === self.findIndex((t) => t.id === emoji.id),
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
        await newNote.recalculateDatabaseEmojis(parsedEmojis);

        // Connect mentions
        await newNote.recalculateDatabaseMentions(parsedMentions);

        // Set attachment parents
        await newNote.recalculateDatabaseAttachments(
            data.mediaAttachments ?? [],
        );

        // Send notifications for mentioned local users
        for (const mention of parsedMentions ?? []) {
            if (mention.isLocal()) {
                await db.insert(Notifications).values({
                    accountId: data.author.id,
                    notifiedId: mention.id,
                    type: "mention",
                    noteId: newNote.id,
                });
            }
        }

        await newNote.reload();

        return newNote;
    }

    /**
     * Update a note from user input
     * @param data - The data to update the note from
     * @returns The updated note
     */
    async updateFromData(data: {
        author: User;
        content?: ContentFormat;
        visibility?: ApiStatus["visibility"];
        isSensitive?: boolean;
        spoilerText?: string;
        emojis?: Emoji[];
        uri?: string;
        mentions?: User[];
        /** List of IDs of database Attachment objects */
        mediaAttachments?: string[];
        replyId?: string;
        quoteId?: string;
        application?: Application;
    }): Promise<Note> {
        const plaintextContent = data.content
            ? data.content["text/plain"]?.content ??
              Object.entries(data.content)[0][1].content
            : undefined;

        const parsedMentions = [
            ...(data.mentions ?? []),
            ...(plaintextContent
                ? await parseTextMentions(plaintextContent, data.author)
                : []),
            // Deduplicate by .id
        ].filter(
            (mention, index, self) =>
                index === self.findIndex((t) => t.id === mention.id),
        );

        const parsedEmojis = [
            ...(data.emojis ?? []),
            ...(plaintextContent
                ? await Emoji.parseFromText(plaintextContent)
                : []),
            // Deduplicate by .id
        ].filter(
            (emoji, index, self) =>
                index === self.findIndex((t) => t.id === emoji.id),
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
        await this.recalculateDatabaseEmojis(parsedEmojis);

        // Connect mentions
        await this.recalculateDatabaseMentions(parsedMentions);

        // Set attachment parents
        await this.recalculateDatabaseAttachments(data.mediaAttachments ?? []);

        await this.reload();

        return this;
    }

    /**
     * Updates the emojis associated with this note in the database
     *
     * Deletes all existing emojis associated with this note, then replaces them with the provided emojis.
     * @param emojis - The emojis to associate with this note
     */
    public async recalculateDatabaseEmojis(emojis: Emoji[]): Promise<void> {
        // Fuse and deduplicate
        const fusedEmojis = emojis.filter(
            (emoji, index, self) =>
                index === self.findIndex((t) => t.id === emoji.id),
        );

        // Connect emojis
        await db
            .delete(EmojiToNote)
            .where(eq(EmojiToNote.noteId, this.data.id));

        for (const emoji of fusedEmojis) {
            await db
                .insert(EmojiToNote)
                .values({
                    emojiId: emoji.id,
                    noteId: this.data.id,
                })
                .execute();
        }
    }

    /**
     * Updates the mentions associated with this note in the database
     *
     * Deletes all existing mentions associated with this note, then replaces them with the provided mentions.
     * @param mentions - The mentions to associate with this note
     */
    public async recalculateDatabaseMentions(mentions: User[]): Promise<void> {
        // Connect mentions
        await db
            .delete(NoteToMentions)
            .where(eq(NoteToMentions.noteId, this.data.id));

        for (const mention of mentions) {
            await db
                .insert(NoteToMentions)
                .values({
                    noteId: this.data.id,
                    userId: mention.id,
                })
                .execute();
        }
    }

    /**
     * Updates the attachments associated with this note in the database
     *
     * Deletes all existing attachments associated with this note, then replaces them with the provided attachments.
     * @param mediaAttachments - The IDs of the attachments to associate with this note
     */
    public async recalculateDatabaseAttachments(
        mediaAttachments: string[],
    ): Promise<void> {
        // Set attachment parents
        await db
            .update(Attachments)
            .set({
                noteId: null,
            })
            .where(eq(Attachments.noteId, this.data.id));

        if (mediaAttachments.length > 0) {
            await db
                .update(Attachments)
                .set({
                    noteId: this.data.id,
                })
                .where(inArray(Attachments.id, mediaAttachments));
        }
    }

    /**
     * Resolve a note from a URI
     * @param uri - The URI of the note to resolve
     * @returns The resolved note
     */
    static async resolve(uri: string): Promise<Note | null> {
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

        return await Note.saveFromRemote(uri);
    }

    /**
     * Save a note from a remote server
     * @param uri - The URI of the note to save
     * @returns The saved note, or null if the note could not be fetched
     */
    static async saveFromRemote(uri: string): Promise<Note | null> {
        let note: LysandNote | null = null;

        if (uri) {
            if (!URL.canParse(uri)) {
                throw new Error(`Invalid URI to parse ${uri}`);
            }

            const requester =
                await User.getServerActor().getFederationRequester();

            const { data } = await requester.get(uri, {
                // @ts-expect-error Bun extension
                proxy: config.http.proxy.address,
            });

            note = await new EntityValidator().Note(data);
        }

        if (!note) {
            throw new Error("No note was able to be fetched");
        }

        const author = await User.resolve(note.author);

        if (!author) {
            throw new Error("Invalid object author");
        }

        return await Note.fromLysand(note, author);
    }

    /**
     * Turns a Lysand Note into a database note (saved)
     * @param note Lysand Note
     * @param author Author of the note
     * @returns The saved note
     */
    static async fromLysand(note: LysandNote, author: User): Promise<Note> {
        const emojis: Emoji[] = [];
        const logger = getLogger("federation");

        for (const emoji of note.extensions?.["org.lysand:custom_emojis"]
            ?.emojis ?? []) {
            const resolvedEmoji = await Emoji.fetchFromRemote(emoji).catch(
                (e) => {
                    logger.error`${e}`;
                    sentry?.captureException(e);
                    return null;
                },
            );

            if (resolvedEmoji) {
                emojis.push(resolvedEmoji);
            }
        }

        const attachments: Attachment[] = [];

        for (const attachment of note.attachments ?? []) {
            const resolvedAttachment = await Attachment.fromLysand(
                attachment,
            ).catch((e) => {
                logger.error`${e}`;
                sentry?.captureException(e);
                return null;
            });

            if (resolvedAttachment) {
                attachments.push(resolvedAttachment);
            }
        }

        const newData = {
            author,
            content: note.content ?? {
                "text/plain": {
                    content: "",
                },
            },
            visibility: note.visibility as ApiStatus["visibility"],
            isSensitive: note.is_sensitive ?? false,
            spoilerText: note.subject ?? "",
            emojis,
            uri: note.uri,
            mentions: await Promise.all(
                (note.mentions ?? [])
                    .map((mention) => User.resolve(mention))
                    .filter((mention) => mention !== null) as Promise<User>[],
            ),
            mediaAttachments: attachments.map((a) => a.id),
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

    async delete(ids: string[]): Promise<void>;
    async delete(): Promise<void>;
    async delete(ids?: unknown): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Notes).where(inArray(Notes.id, ids));
        } else {
            await db.delete(Notes).where(eq(Notes.id, this.id));
        }
    }

    async update(
        newStatus: Partial<StatusWithRelations>,
    ): Promise<StatusWithRelations> {
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
    async isViewableByUser(user: User | null): Promise<boolean> {
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
                      where: (relationship, { and, eq }) =>
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
    async toApi(userFetching?: User | null): Promise<ApiStatus> {
        const data = this.data;

        // Convert mentions of local users from @username@host to @username
        const mentionedLocalUsers = data.mentions.filter(
            (mention) => mention.instanceId === null,
        );

        // Rewrite all src tags to go through proxy
        let replacedContent = new HTMLRewriter()
            .on("[src]", {
                element(element) {
                    element.setAttribute(
                        "src",
                        proxyUrl(element.getAttribute("src") ?? "") ?? "",
                    );
                },
            })
            .transform(data.content);

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
                ? applicationToApi(data.application)
                : null,
            card: null,
            content: replacedContent,
            emojis: data.emojis.map((emoji) => new Emoji(emoji).toApi()),
            favourited: data.liked,
            favourites_count: data.likeCount,
            media_attachments: (data.attachments ?? []).map(
                (a) => new Attachment(a).toApi() as ApiAttachment,
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
                ? await new Note(data.reblog as StatusWithRelations).toApi(
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
                ? (await Note.fromId(data.quotingId, userFetching?.id).then(
                      (n) => n?.toApi(userFetching),
                  )) ?? null
                : null,
            edited_at: data.updatedAt
                ? new Date(data.updatedAt).toISOString()
                : null,
            emoji_reactions: [],
            plain_content: data.contentSource,
        };
    }

    getUri(): string {
        return localObjectUri(this.data.id);
    }

    static getUri(id?: string | null): string | null {
        if (!id) {
            return null;
        }
        return localObjectUri(id);
    }

    /**
     * Get the frontend URI of this note
     * @returns The frontend URI of this note
     */
    getMastoUri(): string {
        return new URL(
            `/@${this.author.data.username}/${this.id}`,
            config.http.base_url,
        ).toString();
    }

    /**
     * Convert a note to the Lysand format
     * @returns The note in the Lysand format
     */
    toLysand(): LysandNote {
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
                },
                "text/plain": {
                    content: htmlToText(status.content),
                },
            },
            attachments: (status.attachments ?? []).map((attachment) =>
                new Attachment(attachment).toLysand(),
            ),
            is_sensitive: status.sensitive,
            mentions: status.mentions.map((mention) =>
                User.getUri(mention.id, mention.uri, config.http.base_url),
            ),
            quotes: Note.getUri(status.quotingId) ?? undefined,
            replies_to: Note.getUri(status.replyId) ?? undefined,
            subject: status.spoilerText,
            visibility: status.visibility as
                | "public"
                | "unlisted"
                | "private"
                | "direct",
            extensions: {
                "org.lysand:custom_emojis": {
                    emojis: status.emojis.map((emoji) =>
                        new Emoji(emoji).toLysand(),
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
    async getAncestors(fetcher: User | null): Promise<Note[]> {
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
        const viewableAncestors = ancestors.filter((ancestor) =>
            ancestor.isViewableByUser(fetcher),
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
    async getDescendants(fetcher: User | null, depth = 0): Promise<Note[]> {
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

        const viewableDescendants = descendants.filter((descendant) =>
            descendant.isViewableByUser(fetcher),
        );

        return viewableDescendants;
    }
}
