import { emojiValidatorWithColons, emojiValidatorWithIdentifiers } from "@/api";
import { proxyUrl } from "@/response";
import type { Emoji as APIEmoji } from "@versia/client/types";
import type { CustomEmojiExtension } from "@versia/federation/types";
import { type Instance, db } from "@versia/kit/db";
import { Emojis, type Instances } from "@versia/kit/tables";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    and,
    desc,
    eq,
    inArray,
    isNull,
} from "drizzle-orm";
import { z } from "zod";
import { BaseInterface } from "./base.ts";

type EmojiWithInstance = InferSelectModel<typeof Emojis> & {
    instance: InferSelectModel<typeof Instances> | null;
};

export class Emoji extends BaseInterface<typeof Emojis, EmojiWithInstance> {
    public static schema = z.object({
        id: z.string(),
        shortcode: z.string(),
        url: z.string(),
        visible_in_picker: z.boolean(),
        category: z.string().optional(),
        static_url: z.string(),
        global: z.boolean(),
    });

    public static $type: EmojiWithInstance;

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
            with: { ...extra?.with, instance: true },
        });

        return found.map((s) => new Emoji(s));
    }

    public async update(
        newEmoji: Partial<EmojiWithInstance>,
    ): Promise<EmojiWithInstance> {
        await db.update(Emojis).set(newEmoji).where(eq(Emojis.id, this.id));

        const updated = await Emoji.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update emoji");
        }

        this.data = updated.data;
        return updated.data;
    }

    public save(): Promise<EmojiWithInstance> {
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
        emojiToFetch: CustomEmojiExtension["emojis"][0],
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
        const matches = text.match(emojiValidatorWithColons);
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

    public toApi(): APIEmoji {
        return {
            id: this.id,
            shortcode: this.data.shortcode,
            static_url: proxyUrl(this.data.url) ?? "", // TODO: Add static version
            url: proxyUrl(this.data.url) ?? "",
            visible_in_picker: this.data.visibleInPicker,
            category: this.data.category ?? undefined,
            global: this.data.ownerId === null,
            description: this.data.alt ?? undefined,
        };
    }

    public toVersia(): CustomEmojiExtension["emojis"][0] {
        return {
            name: `:${this.data.shortcode}:`,
            url: {
                [this.data.contentType]: {
                    content: this.data.url,
                    description: this.data.alt || undefined,
                    remote: true,
                },
            },
        };
    }

    public static fromVersia(
        emoji: CustomEmojiExtension["emojis"][0],
        instance: Instance,
    ): Promise<Emoji> {
        // Extracts the shortcode from the emoji name (e.g. :shortcode: -> shortcode)
        const shortcode = [
            ...emoji.name.matchAll(emojiValidatorWithIdentifiers),
        ][0].groups.shortcode;

        if (!shortcode) {
            throw new Error("Could not extract shortcode from emoji name");
        }

        return Emoji.insert({
            shortcode,
            url: Object.entries(emoji.url)[0][1].content,
            alt: Object.entries(emoji.url)[0][1].description || undefined,
            contentType: Object.keys(emoji.url)[0],
            visibleInPicker: true,
            instanceId: instance.id,
        });
    }
}
