import type { Emoji as APIEmoji } from "@versia/client/types";
import type { ReactionExtension } from "@versia/federation/types";
import { Emoji, Instance, Note, User, db } from "@versia/kit/db";
import { type Notes, Reactions, type Users } from "@versia/kit/tables";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import { z } from "zod";
import { config } from "~/packages/config-manager/index.ts";
import { BaseInterface } from "./base.ts";

type ReactionType = InferSelectModel<typeof Reactions> & {
    emoji: typeof Emoji.$type | null;
    author: InferSelectModel<typeof Users>;
    note: InferSelectModel<typeof Notes>;
};

export interface APIReaction {
    id: string;
    author_id: string;
    emoji: APIEmoji | string;
}

export class Reaction extends BaseInterface<typeof Reactions, ReactionType> {
    public static schema: z.ZodType<APIReaction> = z.object({
        id: z.string().uuid(),
        author_id: z.string().uuid(),
        emoji: z.lazy(() => Emoji.schema),
    });

    public static $type: ReactionType;

    public async reload(): Promise<void> {
        const reloaded = await Reaction.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload reaction");
        }

        this.data = reloaded.data;
    }

    public static async fromId(id: string | null): Promise<Reaction | null> {
        if (!id) {
            return null;
        }

        return await Reaction.fromSql(eq(Reactions.id, id));
    }

    public static async fromIds(ids: string[]): Promise<Reaction[]> {
        return await Reaction.manyFromSql(inArray(Reactions.id, ids));
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Reactions.id),
    ): Promise<Reaction | null> {
        const found = await db.query.Reactions.findFirst({
            where: sql,
            with: {
                emoji: {
                    with: {
                        instance: true,
                    },
                },
                author: true,
                note: true,
            },
            orderBy,
        });

        if (!found) {
            return null;
        }
        return new Reaction(found);
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Reactions.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Reactions.findMany>[0],
    ): Promise<Reaction[]> {
        const found = await db.query.Reactions.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: {
                ...extra?.with,
                emoji: {
                    with: {
                        instance: true,
                    },
                },
                author: true,
                note: true,
            },
        });

        return found.map((s) => new Reaction(s));
    }

    public async update(
        newReaction: Partial<ReactionType>,
    ): Promise<ReactionType> {
        await db
            .update(Reactions)
            .set(newReaction)
            .where(eq(Reactions.id, this.id));

        const updated = await Reaction.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update reaction");
        }

        this.data = updated.data;
        return updated.data;
    }

    public save(): Promise<ReactionType> {
        return this.update(this.data);
    }

    public async delete(ids?: string[]): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Reactions).where(inArray(Reactions.id, ids));
        } else {
            await db.delete(Reactions).where(eq(Reactions.id, this.id));
        }
    }

    public static async insert(
        data: InferInsertModel<typeof Reactions>,
    ): Promise<Reaction> {
        // Needs one of emojiId or emojiText, but not both
        if (!(data.emojiId || data.emojiText)) {
            throw new Error("EmojiID or emojiText is required");
        }

        if (data.emojiId && data.emojiText) {
            throw new Error("Cannot have both emojiId and emojiText");
        }

        const inserted = (
            await db.insert(Reactions).values(data).returning()
        )[0];

        const reaction = await Reaction.fromId(inserted.id);

        if (!reaction) {
            throw new Error("Failed to insert reaction");
        }

        return reaction;
    }

    public get id(): string {
        return this.data.id;
    }

    public toApi(): APIReaction {
        return {
            id: this.data.id,
            author_id: this.data.authorId,
            emoji: this.hasCustomEmoji()
                ? new Emoji(this.data.emoji as typeof Emoji.$type).toApi()
                : this.data.emojiText || "",
        };
    }

    public getUri(baseUrl: string): string {
        return (
            this.data.uri ||
            new URL(
                `/objects/${this.data.noteId}/reactions/${this.id}`,
                baseUrl,
            ).toString()
        );
    }

    public isLocal(): boolean {
        return this.data.author.instanceId === null;
    }

    public hasCustomEmoji(): boolean {
        return !!this.data.emoji || !this.data.emojiText;
    }

    public toVersia(): ReactionExtension {
        if (!this.isLocal()) {
            throw new Error("Cannot convert a non-local reaction to Versia");
        }

        return {
            uri: this.getUri(config.http.base_url),
            type: "pub.versia:reactions/Reaction",
            author: User.getUri(
                this.data.authorId,
                this.data.author.uri,
                config.http.base_url,
            ),
            created_at: new Date(this.data.createdAt).toISOString(),
            id: this.id,
            object: Note.getUri(
                this.data.note.id,
                this.data.note.uri,
            ) as string,
            content: this.hasCustomEmoji()
                ? `:${this.data.emoji?.shortcode}:`
                : this.data.emojiText || "",
            extensions: this.hasCustomEmoji()
                ? {
                      "pub.versia:custom_emojis": {
                          emojis: [
                              new Emoji(
                                  this.data.emoji as typeof Emoji.$type,
                              ).toVersia(),
                          ],
                      },
                  }
                : undefined,
        };
    }

    public static async fromVersia(
        reactionToConvert: ReactionExtension,
        author: User,
        note: Note,
    ): Promise<Reaction> {
        if (author.isLocal()) {
            throw new Error("Cannot process a reaction from a local user");
        }

        const emojiEntity =
            reactionToConvert.extensions?.["pub.versia:custom_emojis"]
                ?.emojis[0];
        const emoji = emojiEntity
            ? await Emoji.fetchFromRemote(
                  emojiEntity,
                  new Instance(
                      author.data.instance as NonNullable<
                          (typeof User.$type)["instance"]
                      >,
                  ),
              )
            : null;

        return Reaction.insert({
            uri: reactionToConvert.uri,
            authorId: author.id,
            noteId: note.id,
            emojiId: emoji ? emoji.id : null,
            emojiText: emoji ? null : reactionToConvert.content,
        });
    }
}
