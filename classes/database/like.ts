import { RolePermission } from "@versia/client/types";
import type { Delete, LikeExtension } from "@versia/federation/types";
import { db } from "@versia/kit/db";
import { Likes } from "@versia/kit/tables";
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
import type { Status } from "../functions/status.ts";
import type { UserType } from "../functions/user.ts";
import { BaseInterface } from "./base.ts";
import { Note } from "./note.ts";
import { User } from "./user.ts";

export type LikeType = InferSelectModel<typeof Likes> & {
    liker: UserType;
    liked: Status;
};

export class Like extends BaseInterface<typeof Likes, LikeType> {
    public static schema = z.object({
        id: z.string(),
        name: z.string(),
        permissions: z.array(z.nativeEnum(RolePermission)),
        priority: z.number(),
        description: z.string().nullable(),
        visible: z.boolean(),
        icon: z.string().nullable(),
    });

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
    ) {
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
    ) {
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

    public get id() {
        return this.data.id;
    }

    public getUri(): URL {
        return new URL(`/objects/${this.data.id}`, config.http.base_url);
    }

    public toVersia(): LikeExtension {
        return {
            id: this.data.id,
            author: User.getUri(
                this.data.liker.id,
                this.data.liker.uri,
                config.http.base_url,
            ),
            type: "pub.versia:likes/Like",
            created_at: new Date(this.data.createdAt).toISOString(),
            liked: Note.getUri(
                this.data.liked.id,
                this.data.liked.uri,
            ) as string,
            uri: this.getUri().toString(),
        };
    }

    public unlikeToVersia(unliker?: User): Delete {
        return {
            type: "Delete",
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            author: User.getUri(
                unliker?.id ?? this.data.liker.id,
                unliker?.data.uri ?? this.data.liker.uri,
                config.http.base_url,
            ),
            deleted_type: "pub.versia:likes/Like",
            deleted: this.getUri().toString(),
        };
    }
}
