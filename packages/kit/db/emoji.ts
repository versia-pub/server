import {
    type CustomEmoji,
    emojiWithColonsRegex,
    emojiWithIdentifiersRegex,
} from "@versia/client/schemas";
import * as VersiaEntities from "@versia/sdk/entities";
import type { ImageContentFormatSchema } from "@versia/sdk/schemas";
import { randomUUIDv7 } from "bun";
import {
    and,
    desc,
    eq,
    type InferInsertModel,
    type InferSelectModel,
    inArray,
    isNull,
    type SQL,
} from "drizzle-orm";
import type { z } from "zod/v4";
import { db } from "../tables/db.ts";
import { Emojis, type Instances, type Medias } from "../tables/schema.ts";
import { BaseInterface } from "./base.ts";
import type { Instance } from "./instance.ts";
import { Media } from "./media.ts";

type EmojiType = InferSelectModel<typeof Emojis> & {
    media: InferSelectModel<typeof Medias>;
    instance: InferSelectModel<typeof Instances> | null;
};

export class Emoji extends BaseInterface<typeof Emojis, EmojiType> {
    public static $type: EmojiType;
    public media: Media;

    public constructor(data: EmojiType) {
        super(data);
        this.media = new Media(data.media);
    }

    public async reload(): Promise<void> {
        const reloaded = await Emoji.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload emoji");
        }

        this.data = reloaded.data;
    }

    public static async fromId(id: string | null): Promise<Emoji | null> {
        if (!id) {
            return null;
        }

        return await Emoji.fromSql(eq(Emojis.id, id));
    }

    public static async fromIds(ids: string[]): Promise<Emoji[]> {
        return await Emoji.manyFromSql(inArray(Emojis.id, ids));
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Emojis.id),
    ): Promise<Emoji | null> {
        const found = await db.query.Emojis.findFirst({
            where: sql,
            orderBy,
            with: {
                instance: true,
                media: true,
            },
        });

        if (!found) {
            return null;
        }
        return new Emoji(found);
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Emojis.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Emojis.findMany>[0],
    ): Promise<Emoji[]> {
        const found = await db.query.Emojis.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: { ...extra?.with, instance: true, media: true },
        });

        return found.map((s) => new Emoji(s));
    }

    public async update(newEmoji: Partial<EmojiType>): Promise<EmojiType> {
        await db.update(Emojis).set(newEmoji).where(eq(Emojis.id, this.id));

        const updated = await Emoji.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update emoji");
        }

        this.data = updated.data;
        return updated.data;
    }

    public save(): Promise<EmojiType> {
        return this.update(this.data);
    }

    public async delete(ids?: string[]): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Emojis).where(inArray(Emojis.id, ids));
        } else {
            await db.delete(Emojis).where(eq(Emojis.id, this.id));
        }
    }

    public static async insert(
        data: InferInsertModel<typeof Emojis>,
    ): Promise<Emoji> {
        const inserted = (await db.insert(Emojis).values(data).returning())[0];

        const emoji = await Emoji.fromId(inserted.id);

        if (!emoji) {
            throw new Error("Failed to insert emoji");
        }

        return emoji;
    }

    public static async fetchFromRemote(
        emojiToFetch: {
            name: string;
            url: z.infer<typeof ImageContentFormatSchema>;
        },
        instance: Instance,
    ): Promise<Emoji> {
        const existingEmoji = await Emoji.fromSql(
            and(
                eq(Emojis.shortcode, emojiToFetch.name),
                eq(Emojis.instanceId, instance.id),
            ),
        );

        if (existingEmoji) {
            return existingEmoji;
        }

        return await Emoji.fromVersia(emojiToFetch, instance);
    }

    public get id(): string {
        return this.data.id;
    }

    /**
     * Parse emojis from text
     *
     * @param text The text to parse
     * @returns An array of emojis
     */
    public static parseFromText(text: string): Promise<Emoji[]> {
        const matches = text.match(emojiWithColonsRegex);
        if (!matches || matches.length === 0) {
            return Promise.resolve([]);
        }

        return Emoji.manyFromSql(
            and(
                inArray(
                    Emojis.shortcode,
                    matches.map((match) => match.replace(/:/g, "")),
                ),
                isNull(Emojis.instanceId),
            ),
        );
    }

    public toApi(): z.infer<typeof CustomEmoji> {
        return {
            id: this.id,
            shortcode: this.data.shortcode,
            static_url: this.media.getUrl().proxied,
            url: this.media.getUrl().proxied,
            visible_in_picker: this.data.visibleInPicker,
            category: this.data.category,
            global: this.data.ownerId === null,
            description:
                this.media.data.content[this.media.getPreferredMimeType()]
                    ?.description ?? null,
        };
    }

    public toVersia(): {
        name: string;
        url: z.infer<typeof ImageContentFormatSchema>;
    } {
        return {
            name: `:${this.data.shortcode}:`,
            url: this.media.toVersia().data as z.infer<
                typeof ImageContentFormatSchema
            >,
        };
    }

    public static async fromVersia(
        emoji: {
            name: string;
            url: z.infer<typeof ImageContentFormatSchema>;
        },
        instance: Instance,
    ): Promise<Emoji> {
        // Extracts the shortcode from the emoji name (e.g. :shortcode: -> shortcode)
        const shortcode = [...emoji.name.matchAll(emojiWithIdentifiersRegex)][0]
            .groups.shortcode;

        if (!shortcode) {
            throw new Error("Could not extract shortcode from emoji name");
        }

        const media = await Media.fromVersia(
            new VersiaEntities.ImageContentFormat(emoji.url),
        );

        return Emoji.insert({
            id: randomUUIDv7(),
            shortcode,
            mediaId: media.id,
            visibleInPicker: true,
            instanceId: instance.id,
        });
    }
}
