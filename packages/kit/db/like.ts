import * as VersiaEntities from "@versia/sdk/entities";
import {
    and,
    desc,
    eq,
    type InferInsertModel,
    type InferSelectModel,
    inArray,
    type SQL,
} from "drizzle-orm";
import { db } from "../tables/db.ts";
import {
    type Instances,
    Likes,
    type Notes,
    Notifications,
    type Users,
} from "../tables/schema.ts";
import { BaseInterface } from "./base.ts";
import type { User } from "./user.ts";

type LikeType = InferSelectModel<typeof Likes> & {
    liker: InferSelectModel<typeof Users>;
    liked: InferSelectModel<typeof Notes> & {
        author: InferSelectModel<typeof Users> & {
            instance: InferSelectModel<typeof Instances> | null;
        };
    };
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
                liked: {
                    with: {
                        author: {
                            with: {
                                instance: true,
                            },
                        },
                    },
                },
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
    ): Promise<Like[]> {
        const found = await db.query.Likes.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: {
                liked: {
                    with: {
                        author: {
                            with: {
                                instance: true,
                            },
                        },
                    },
                },
                liker: true,
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

    public async delete(): Promise<void> {
        await db.delete(Likes).where(eq(Likes.id, this.id));
    }

    public static async insert(
        data: InferInsertModel<typeof Likes>,
    ): Promise<Like> {
        const inserted = (await db.insert(Likes).values(data).returning())[0];

        const like = await Like.fromId(inserted.id);

        if (!like) {
            throw new Error("Failed to insert like");
        }

        return like;
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

    public toVersia(): VersiaEntities.Like {
        let likedReference = this.data.liked.id;

        if (this.data.liked.author.instance) {
            likedReference = `${this.data.liked.author.instance.domain}:${this.data.liked.remoteId}`;
        }

        return new VersiaEntities.Like({
            id: this.id,
            author: this.data.liker.id,
            type: "pub.versia:likes/Like",
            created_at: this.data.createdAt.toISOString(),
            liked: likedReference,
        });
    }

    public unlikeToVersia(unliker?: User): VersiaEntities.Delete {
        return new VersiaEntities.Delete({
            type: "Delete",
            created_at: new Date().toISOString(),
            author: unliker ? unliker.id : this.data.liker.id,
            deleted_type: "pub.versia:likes/Like",
            deleted: this.id,
        });
    }
}
