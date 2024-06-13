import { idValidator } from "@/api";
import { dualLogger } from "@/loggers";
import { proxyUrl } from "@/response";
import { sanitizedHtmlStrip } from "@/sanitization";
import { EntityValidator } from "@lysand-org/federation";
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
import { LogLevel } from "log-manager";
import { createRegExp, exactly, global } from "magic-regexp";
import {
    type Application,
    applicationToApi,
} from "~/database/entities/application";
import { parseEmojis } from "~/database/entities/emoji";
import { localObjectUri } from "~/database/entities/federation";
import {
    type StatusWithRelations,
    contentToHtml,
    findManyNotes,
    parseTextMentions,
} from "~/database/entities/status";
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
import type { Attachment as apiAttachment } from "~/types/mastodon/attachment";
import type { Status as apiStatus } from "~/types/mastodon/status";
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

    static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Notes.id),
        userId?: string,
    ) {
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

    static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Notes.id),
        limit?: number,
        offset?: number,
        userId?: string,
    ) {
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

    async getUsersToFederateTo() {
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
                                eq(relationship.subjectId, Users.id),
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

    isNull() {
        return this.data === null;
    }

    get author() {
        return new User(this.data.author);
    }

    static async getCount() {
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

    async getReplyChildren(userId?: string) {
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

    async updateFromRemote() {
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

    static async fromData(data: {
        author: User;
        content: typeof EntityValidator.$ContentFormat;
        visibility: apiStatus["visibility"];
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
            ...(await parseTextMentions(plaintextContent)),
            // Deduplicate by .id
        ].filter(
            (mention, index, self) =>
                index === self.findIndex((t) => t.id === mention.id),
        );

        const parsedEmojis = [
            ...(data.emojis ?? []),
            ...(await parseEmojis(plaintextContent)),
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

    async updateFromData(data: {
        author?: User;
        content?: typeof EntityValidator.$ContentFormat;
        visibility?: apiStatus["visibility"];
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
                ? await parseTextMentions(plaintextContent)
                : []),
            // Deduplicate by .id
        ].filter(
            (mention, index, self) =>
                index === self.findIndex((t) => t.id === mention.id),
        );

        const parsedEmojis = [
            ...(data.emojis ?? []),
            ...(plaintextContent ? await parseEmojis(plaintextContent) : []),
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

    static async resolve(
        uri?: string,
        providedNote?: typeof EntityValidator.$Note,
    ): Promise<Note | null> {
        // Check if note not already in database
        const foundNote = uri && (await Note.fromSql(eq(Notes.uri, uri)));

        if (foundNote) {
            return foundNote;
        }

        // Check if URI is of a local note
        if (uri?.startsWith(config.http.base_url)) {
            const uuid = uri.match(idValidator);

            if (!uuid?.[0]) {
                throw new Error(
                    `URI ${uri} is of a local note, but it could not be parsed`,
                );
            }

            return await Note.fromId(uuid[0]);
        }

        return await Note.saveFromRemote(uri, providedNote);
    }

    static async saveFromRemote(
        uri?: string,
        providedNote?: typeof EntityValidator.$Note,
    ): Promise<Note | null> {
        if (!(uri || providedNote)) {
            throw new Error("No URI or note provided");
        }

        let note = providedNote || null;

        if (uri) {
            if (!URL.canParse(uri)) {
                throw new Error(`Invalid URI to parse ${uri}`);
            }

            const response = await fetch(uri, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                },
            });

            note = await new EntityValidator().Note(await response.json());
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

    static async fromLysand(
        note: typeof EntityValidator.$Note,
        author: User,
    ): Promise<Note> {
        const emojis = [];

        for (const emoji of note.extensions?.["org.lysand:custom_emojis"]
            ?.emojis ?? []) {
            const resolvedEmoji = await Emoji.fetchFromRemote(emoji).catch(
                (e) => {
                    dualLogger.logError(
                        LogLevel.Error,
                        "Federation.StatusResolver",
                        e,
                    );
                    return null;
                },
            );

            if (resolvedEmoji) {
                emojis.push(resolvedEmoji);
            }
        }

        const attachments = [];

        for (const attachment of note.attachments ?? []) {
            const resolvedAttachment = await Attachment.fromLysand(
                attachment,
            ).catch((e) => {
                dualLogger.logError(
                    LogLevel.Error,
                    "Federation.StatusResolver",
                    e,
                );
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
            visibility: note.visibility as apiStatus["visibility"],
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
    async isViewableByUser(user: User | null) {
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
                ? await db.query.Relationships.findFirst({
                      where: (relationship, { and, eq }) =>
                          and(
                              eq(relationship.ownerId, user?.id),
                              eq(relationship.subjectId, Notes.authorId),
                              eq(relationship.following, true),
                          ),
                  })
                : false;
        }
        return (
            user && this.data.mentions.find((mention) => mention.id === user.id)
        );
    }

    async toApi(userFetching?: User | null): Promise<apiStatus> {
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
                (a) => new Attachment(a).toApi() as apiAttachment,
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
            visibility: data.visibility as apiStatus["visibility"],
            url: data.uri || this.getMastoUri(),
            bookmarked: false,
            // @ts-expect-error Glitch-SOC extension
            quote: data.quotingId
                ? (await Note.fromId(data.quotingId, userFetching?.id).then(
                      (n) => n?.toApi(userFetching),
                  )) ?? null
                : null,
            quote_id: data.quotingId || undefined,
        };
    }

    getUri() {
        return localObjectUri(this.data.id);
    }

    static getUri(id?: string | null) {
        if (!id) {
            return null;
        }
        return localObjectUri(id);
    }

    getMastoUri() {
        return new URL(
            `/@${this.author.data.username}/${this.id}`,
            config.http.base_url,
        ).toString();
    }

    toLysand(): typeof EntityValidator.$Note {
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
            mentions: status.mentions.map((mention) => mention.uri || ""),
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
     */
    async getAncestors(fetcher: User | null) {
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
     */
    async getDescendants(fetcher: User | null, depth = 0) {
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
