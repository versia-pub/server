import { proxyUrl } from "@/response";
import type { CustomEmojiExtension } from "@lysand-org/federation/types";
import {
    type InferInsertModel,
    type SQL,
    and,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import type { EmojiWithInstance } from "~/classes/functions/emoji";
import { addInstanceIfNotExists } from "~/classes/functions/instance";
import { db } from "~/drizzle/db";
import { Emojis, Instances } from "~/drizzle/schema";
import type { Emoji as APIEmoji } from "~/types/mastodon/emoji";
import { BaseInterface } from "./base";

export class Emoji extends BaseInterface<typeof Emojis, EmojiWithInstance> {
    async reload(): Promise<void> {
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

    async update(
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

    save(): Promise<EmojiWithInstance> {
        return this.update(this.data);
    }

    async delete(ids: string[]): Promise<void>;
    async delete(): Promise<void>;
    async delete(ids?: unknown): Promise<void> {
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
        host?: string,
    ): Promise<Emoji> {
        const existingEmoji = await db
            .select()
            .from(Emojis)
            .innerJoin(Instances, eq(Emojis.instanceId, Instances.id))
            .where(
                and(
                    eq(Emojis.shortcode, emojiToFetch.name),
                    host ? eq(Instances.baseUrl, host) : undefined,
                ),
            )
            .limit(1);

        if (existingEmoji[0]) {
            const found = await Emoji.fromId(existingEmoji[0].Emojis.id);

            if (!found) {
                throw new Error("Failed to fetch emoji");
            }

            return found;
        }

        const foundInstance = host ? await addInstanceIfNotExists(host) : null;

        return await Emoji.fromLysand(emojiToFetch, foundInstance?.id ?? null);
    }

    get id() {
        return this.data.id;
    }

    public toApi(): APIEmoji {
        return {
            // @ts-expect-error ID is not in regular Mastodon API
            id: this.id,
            shortcode: this.data.shortcode,
            static_url: proxyUrl(this.data.url) ?? "", // TODO: Add static version
            url: proxyUrl(this.data.url) ?? "",
            visible_in_picker: this.data.visibleInPicker,
            category: this.data.category ?? undefined,
        };
    }

    public toLysand(): CustomEmojiExtension["emojis"][0] {
        return {
            name: this.data.shortcode,
            url: {
                [this.data.contentType]: {
                    content: this.data.url,
                    description: this.data.alt || undefined,
                },
            },
        };
    }

    public static fromLysand(
        emoji: CustomEmojiExtension["emojis"][0],
        instanceId: string | null,
    ): Promise<Emoji> {
        return Emoji.insert({
            shortcode: emoji.name,
            url: Object.entries(emoji.url)[0][1].content,
            alt: Object.entries(emoji.url)[0][1].description || undefined,
            contentType: Object.keys(emoji.url)[0],
            visibleInPicker: true,
            instanceId: instanceId,
        });
    }
}
