import { db } from "@versia/kit/db";
import {
    Likes,
    type Notes,
    Notifications,
    type Users,
} from "@versia/kit/tables";
import * as VersiaEntities from "@versia/sdk/entities";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    and,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import { config } from "~/config.ts";
import { BaseInterface } from "./base.ts";
import { User } from "./user.ts";

type LikeType = InferSelectModel<typeof Likes> & {
    liker: InferSelectModel<typeof Users>;
    liked: InferSelectModel<typeof Notes>;
};

export class Like extends BaseInterface<typeof Likes, LikeType> {
    public static $type: LikeType;

    public async reload(): Promise<void> {
        const reloaded = await Like.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload like");
        }

        this.data = reloaded.data;
    }

    public static async fromId(id: string | null): Promise<Like | null> {
        if (!id) {
            return null;
        }

        return await Like.fromSql(eq(Likes.id, id));
    }

    public static async fromIds(ids: string[]): Promise<Like[]> {
        return await Like.manyFromSql(inArray(Likes.id, ids));
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Likes.id),
    ): Promise<Like | null> {
        const found = await db.query.Likes.findFirst({
            where: sql,
            orderBy,
            with: {
                liked: true,
                liker: true,
            },
        });

        if (!found) {
            return null;
        }
        return new Like(found);
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Likes.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Likes.findMany>[0],
    ): Promise<Like[]> {
        const found = await db.query.Likes.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: {
                liked: true,
                liker: true,
                ...extra?.with,
            },
        });

        return found.map((s) => new Like(s));
    }

    public async update(newRole: Partial<LikeType>): Promise<LikeType> {
        await db.update(Likes).set(newRole).where(eq(Likes.id, this.id));

        const updated = await Like.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update like");
        }

        return updated.data;
    }

    public save(): Promise<LikeType> {
        return this.update(this.data);
    }

    public async delete(ids?: string[]): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Likes).where(inArray(Likes.id, ids));
        } else {
            await db.delete(Likes).where(eq(Likes.id, this.id));
        }
    }

    public static async insert(
        data: InferInsertModel<typeof Likes>,
    ): Promise<Like> {
        const inserted = (await db.insert(Likes).values(data).returning())[0];

        const role = await Like.fromId(inserted.id);

        if (!role) {
            throw new Error("Failed to insert like");
        }

        return role;
    }

    public get id(): string {
        return this.data.id;
    }

    public async clearRelatedNotifications(): Promise<void> {
        await db
            .delete(Notifications)
            .where(
                and(
                    eq(Notifications.accountId, this.id),
                    eq(Notifications.type, "favourite"),
                    eq(Notifications.notifiedId, this.data.liked.authorId),
                    eq(Notifications.noteId, this.data.liked.id),
                ),
            );
    }

    public getUri(): URL {
        return new URL(`/likes/${this.data.id}`, config.http.base_url);
    }

    public toVersia(): VersiaEntities.Like {
        return new VersiaEntities.Like({
            id: this.data.id,
            author: User.getUri(
                this.data.liker.id,
                this.data.liker.uri ? new URL(this.data.liker.uri) : null,
            ),
            type: "pub.versia:likes/Like",
            created_at: new Date(this.data.createdAt).toISOString(),
            liked: this.data.liked.uri
                ? new URL(this.data.liked.uri)
                : new URL(`/notes/${this.data.liked.id}`, config.http.base_url),
            uri: this.getUri(),
        });
    }

    public unlikeToVersia(unliker?: User): VersiaEntities.Delete {
        return new VersiaEntities.Delete({
            type: "Delete",
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            author: User.getUri(
                unliker?.id ?? this.data.liker.id,
                unliker?.data.uri
                    ? new URL(unliker.data.uri)
                    : this.data.liker.uri
                      ? new URL(this.data.liker.uri)
                      : null,
            ),
            deleted_type: "pub.versia:likes/Like",
            deleted: this.getUri(),
        });
    }
}
