import {
    type InferInsertModel,
    type SQL,
    and,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import { htmlToText } from "html-to-text";
import type * as Lysand from "lysand-types";
import { createRegExp, exactly, global } from "magic-regexp";
import {
    type Application,
    applicationToAPI,
} from "~database/entities/Application";
import {
    attachmentToAPI,
    attachmentToLysand,
} from "~database/entities/Attachment";
import {
    type EmojiWithInstance,
    emojiToAPI,
    emojiToLysand,
    parseEmojis,
} from "~database/entities/Emoji";
import { localObjectURI } from "~database/entities/Federation";
import {
    type Status,
    type StatusWithRelations,
    contentToHtml,
    findFirstNote,
    findManyNotes,
    getStatusUri,
} from "~database/entities/Status";
import {
    type User,
    type UserWithRelations,
    type UserWithRelationsAndRelationships,
    findManyUsers,
    getUserUri,
    userToAPI,
    userToMention,
} from "~database/entities/User";
import { db } from "~drizzle/db";
import {
    Attachments,
    EmojiToNote,
    NoteToMentions,
    Notes,
    Notifications,
    UserToPinnedNotes,
    Users,
    UsersRelations,
} from "~drizzle/schema";
import { config } from "~packages/config-manager";
import type { Attachment as APIAttachment } from "~types/mastodon/attachment";
import type { Status as APIStatus } from "~types/mastodon/status";

/**
 * Gives helpers to fetch notes from database in a nice format
 */
export class Note {
    private constructor(private status: StatusWithRelations) {}

    static async fromId(id: string | null): Promise<Note | null> {
        if (!id) return null;

        return await Note.fromSql(eq(Notes.id, id));
    }

    static async fromIds(ids: string[]): Promise<Note[]> {
        return await Note.manyFromSql(inArray(Notes.id, ids));
    }

    static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Notes.id),
    ) {
        const found = await findFirstNote({
            where: sql,
            orderBy,
        });

        if (!found) return null;
        return new Note(found);
    }

    static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Notes.id),
        limit?: number,
        offset?: number,
    ) {
        const found = await findManyNotes({
            where: sql,
            orderBy,
            limit,
            offset,
        });

        return found.map((s) => new Note(s));
    }

    async getUsersToFederateTo() {
        // Mentioned users
        const mentionedUsers =
            this.getStatus().mentions.length > 0
                ? await findManyUsers({
                      where: (user, { and, isNotNull, inArray }) =>
                          and(
                              isNotNull(user.instanceId),
                              inArray(
                                  user.id,
                                  this.getStatus().mentions.map(
                                      (mention) => mention.id,
                                  ),
                              ),
                          ),
                  })
                : [];

        const usersThatCanSeePost = await findManyUsers({
            where: (user, { isNotNull }) => isNotNull(user.instanceId),
            with: {
                relationships: {
                    where: (relationship, { eq, and }) =>
                        and(
                            eq(relationship.subjectId, Users.id),
                            eq(relationship.following, true),
                        ),
                },
            },
        });

        const fusedUsers = [...mentionedUsers, ...usersThatCanSeePost];

        const deduplicatedUsersById = fusedUsers.filter(
            (user, index, self) =>
                index === self.findIndex((t) => t.id === user.id),
        );

        return deduplicatedUsersById;
    }

    static fromStatus(status: StatusWithRelations) {
        return new Note(status);
    }

    static fromStatuses(statuses: StatusWithRelations[]) {
        return statuses.map((s) => new Note(s));
    }

    isNull() {
        return this.status === null;
    }

    getStatus() {
        return this.status;
    }

    getAuthor() {
        return this.status.author;
    }

    async getReplyChildren() {
        return await Note.manyFromSql(eq(Notes.replyId, this.status.id));
    }

    async pin(pinner: User) {
        return (
            await db
                .insert(UserToPinnedNotes)
                .values({
                    noteId: this.status.id,
                    userId: pinner.id,
                })
                .returning()
        )[0];
    }

    async unpin(unpinner: User) {
        return (
            await db
                .delete(UserToPinnedNotes)
                .where(
                    and(
                        eq(NoteToMentions.noteId, this.status.id),
                        eq(NoteToMentions.userId, unpinner.id),
                    ),
                )
                .returning()
        )[0];
    }

    static async insert(values: InferInsertModel<typeof Notes>) {
        return (await db.insert(Notes).values(values).returning())[0];
    }

    static async fromData(
        author: User,
        content: Lysand.ContentFormat,
        visibility: APIStatus["visibility"],
        is_sensitive: boolean,
        spoiler_text: string,
        emojis: EmojiWithInstance[],
        uri?: string,
        mentions?: UserWithRelations[],
        /** List of IDs of database Attachment objects */
        media_attachments?: string[],
        replyId?: string,
        quoteId?: string,
        application?: Application,
    ): Promise<Note | null> {
        const htmlContent = await contentToHtml(content, mentions);

        // Parse emojis and fuse with existing emojis
        let foundEmojis = emojis;

        if (author.instanceId === null) {
            const parsedEmojis = await parseEmojis(htmlContent);
            // Fuse and deduplicate
            foundEmojis = [...emojis, ...parsedEmojis].filter(
                (emoji, index, self) =>
                    index === self.findIndex((t) => t.id === emoji.id),
            );
        }

        const newNote = await Note.insert({
            authorId: author.id,
            content: htmlContent,
            contentSource:
                content["text/plain"]?.content ||
                content["text/markdown"]?.content ||
                Object.entries(content)[0][1].content ||
                "",
            contentType: "text/html",
            visibility,
            sensitive: is_sensitive,
            spoilerText: spoiler_text,
            uri: uri || null,
            replyId: replyId ?? null,
            quotingId: quoteId ?? null,
            applicationId: application?.id ?? null,
        });

        // Connect emojis
        for (const emoji of foundEmojis) {
            await db
                .insert(EmojiToNote)
                .values({
                    emojiId: emoji.id,
                    noteId: newNote.id,
                })
                .execute();
        }

        // Connect mentions
        for (const mention of mentions ?? []) {
            await db
                .insert(NoteToMentions)
                .values({
                    noteId: newNote.id,
                    userId: mention.id,
                })
                .execute();
        }

        // Set attachment parents
        if (media_attachments && media_attachments.length > 0) {
            await db
                .update(Attachments)
                .set({
                    noteId: newNote.id,
                })
                .where(inArray(Attachments.id, media_attachments));
        }

        // Send notifications for mentioned local users
        for (const mention of mentions ?? []) {
            if (mention.instanceId === null) {
                await db.insert(Notifications).values({
                    accountId: author.id,
                    notifiedId: mention.id,
                    type: "mention",
                    noteId: newNote.id,
                });
            }
        }

        return await Note.fromId(newNote.id);
    }

    async updateFromData(
        content?: Lysand.ContentFormat,
        visibility?: APIStatus["visibility"],
        is_sensitive?: boolean,
        spoiler_text?: string,
        emojis: EmojiWithInstance[] = [],
        mentions: UserWithRelations[] = [],
        /** List of IDs of database Attachment objects */
        media_attachments: string[] = [],
    ) {
        const htmlContent = content
            ? await contentToHtml(content, mentions)
            : undefined;

        // Parse emojis and fuse with existing emojis
        let foundEmojis = emojis;

        if (this.getAuthor().instanceId === null && htmlContent) {
            const parsedEmojis = await parseEmojis(htmlContent);
            // Fuse and deduplicate
            foundEmojis = [...emojis, ...parsedEmojis].filter(
                (emoji, index, self) =>
                    index === self.findIndex((t) => t.id === emoji.id),
            );
        }

        const newNote = await this.update({
            content: htmlContent,
            contentSource: content
                ? content["text/plain"]?.content ||
                  content["text/markdown"]?.content ||
                  Object.entries(content)[0][1].content ||
                  ""
                : undefined,
            contentType: "text/html",
            visibility,
            sensitive: is_sensitive,
            spoilerText: spoiler_text,
        });

        // Connect emojis
        await db
            .delete(EmojiToNote)
            .where(eq(EmojiToNote.noteId, this.status.id));

        for (const emoji of foundEmojis) {
            await db
                .insert(EmojiToNote)
                .values({
                    emojiId: emoji.id,
                    noteId: this.status.id,
                })
                .execute();
        }

        // Connect mentions
        await db
            .delete(NoteToMentions)
            .where(eq(NoteToMentions.noteId, this.status.id));

        for (const mention of mentions ?? []) {
            await db
                .insert(NoteToMentions)
                .values({
                    noteId: this.status.id,
                    userId: mention.id,
                })
                .execute();
        }

        // Set attachment parents
        if (media_attachments && media_attachments.length > 0) {
            await db
                .update(Attachments)
                .set({
                    noteId: this.status.id,
                })
                .where(inArray(Attachments.id, media_attachments));
        }

        return await Note.fromId(newNote.id);
    }

    async delete() {
        return (
            await db
                .delete(Notes)
                .where(eq(Notes.id, this.status.id))
                .returning()
        )[0];
    }

    async update(newStatus: Partial<Status>) {
        return (
            await db
                .update(Notes)
                .set(newStatus)
                .where(eq(Notes.id, this.status.id))
                .returning()
        )[0];
    }

    static async deleteMany(ids: string[]) {
        return await db.delete(Notes).where(inArray(Notes.id, ids)).returning();
    }

    /**
     * Returns whether this status is viewable by a user.
     * @param user The user to check.
     * @returns Whether this status is viewable by the user.
     */
    async isViewableByUser(user: UserWithRelations | null) {
        if (this.getAuthor().id === user?.id) return true;
        if (this.getStatus().visibility === "public") return true;
        if (this.getStatus().visibility === "unlisted") return true;
        if (this.getStatus().visibility === "private") {
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
            user &&
            this.getStatus().mentions.find((mention) => mention.id === user.id)
        );
    }

    async toAPI(userFetching?: UserWithRelations | null): Promise<APIStatus> {
        const data = this.getStatus();
        const wasPinnedByUser = userFetching
            ? !!(await db.query.UserToPinnedNotes.findFirst({
                  where: (relation, { and, eq }) =>
                      and(
                          eq(relation.noteId, data.id),
                          eq(relation.userId, userFetching?.id),
                      ),
              }))
            : false;

        const wasRebloggedByUser = userFetching
            ? !!(await Note.fromSql(
                  and(
                      eq(Notes.authorId, userFetching?.id),
                      eq(Notes.reblogId, data.id),
                  ),
              ))
            : false;

        const wasMutedByUser = userFetching
            ? !!(await db.query.Relationships.findFirst({
                  where: (relationship, { and, eq }) =>
                      and(
                          eq(relationship.ownerId, userFetching.id),
                          eq(relationship.subjectId, data.authorId),
                          eq(relationship.muting, true),
                      ),
              }))
            : false;

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
            account: userToAPI(data.author),
            created_at: new Date(data.createdAt).toISOString(),
            application: data.application
                ? applicationToAPI(data.application)
                : null,
            card: null,
            content: replacedContent,
            emojis: data.emojis.map((emoji) => emojiToAPI(emoji)),
            favourited: !!(data.likes ?? []).find(
                (like) => like.likerId === userFetching?.id,
            ),
            favourites_count: (data.likes ?? []).length,
            media_attachments: (data.attachments ?? []).map(
                (a) => attachmentToAPI(a) as APIAttachment,
            ),
            mentions: data.mentions.map((mention) => userToMention(mention)),
            language: null,
            muted: wasMutedByUser,
            pinned: wasPinnedByUser,
            // TODO: Add polls
            poll: null,
            reblog: data.reblog
                ? await Note.fromStatus(
                      data.reblog as StatusWithRelations,
                  ).toAPI(userFetching)
                : null,
            reblogged: wasRebloggedByUser,
            reblogs_count: data.reblogCount,
            replies_count: data.replyCount,
            sensitive: data.sensitive,
            spoiler_text: data.spoilerText,
            tags: [],
            uri:
                data.uri ||
                new URL(
                    `/@${data.author.username}/${data.id}`,
                    config.http.base_url,
                ).toString(),
            visibility: data.visibility as APIStatus["visibility"],
            url: data.uri || this.getMastoURI(),
            bookmarked: false,
            quote: !!data.quotingId,
            // @ts-expect-error Pleroma extension
            quote_id: data.quotingId || undefined,
        };
    }

    getURI() {
        return localObjectURI(this.getStatus().id);
    }

    getMastoURI() {
        return `/@${this.getAuthor().username}/${this.getStatus().id}`;
    }

    toLysand(): Lysand.Note {
        const status = this.getStatus();
        return {
            type: "Note",
            created_at: new Date(status.createdAt).toISOString(),
            id: status.id,
            author: getUserUri(status.author),
            uri: this.getURI(),
            content: {
                "text/html": {
                    content: status.content,
                },
                "text/plain": {
                    content: htmlToText(status.content),
                },
            },
            attachments: (status.attachments ?? []).map((attachment) =>
                attachmentToLysand(attachment),
            ),
            is_sensitive: status.sensitive,
            mentions: status.mentions.map((mention) => mention.uri || ""),
            quotes: getStatusUri(status.quote) ?? undefined,
            replies_to: getStatusUri(status.reply) ?? undefined,
            subject: status.spoilerText,
            visibility: status.visibility as Lysand.Visibility,
            extensions: {
                "org.lysand:custom_emojis": {
                    emojis: status.emojis.map((emoji) => emojiToLysand(emoji)),
                },
                // TODO: Add polls and reactions
            },
        };
    }

    /**
     * Return all the ancestors of this post,
     */
    async getAncestors(fetcher: UserWithRelationsAndRelationships | null) {
        const ancestors: Note[] = [];

        let currentStatus: Note = this;

        while (currentStatus.getStatus().replyId) {
            const parent = await Note.fromId(currentStatus.getStatus().replyId);

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
        return viewableAncestors;
    }

    /**
     * Return all the descendants of this post (recursive)
     * Temporary implementation, will be replaced with a recursive SQL query when I get to it
     */
    async getDescendants(
        fetcher: UserWithRelationsAndRelationships | null,
        depth = 0,
    ) {
        const descendants: Note[] = [];
        for (const child of await this.getReplyChildren()) {
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
