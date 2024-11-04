import type { Token as ApiToken } from "@versia/client/types";
import { User, db } from "@versia/kit/db";
import { type Applications, Tokens } from "@versia/kit/tables";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import { z } from "zod";
import { BaseInterface } from "./base.ts";

export type TokenType = InferSelectModel<typeof Tokens> & {
    application: InferSelectModel<typeof Applications> | null;
};

export class Token extends BaseInterface<typeof Tokens, TokenType> {
    public static schema: z.ZodType<ApiToken> = z.object({
        access_token: z.string(),
        token_type: z.enum(["bearer"]),
        scope: z.string(),
        created_at: z.number(),
    });

    public async reload(): Promise<void> {
        const reloaded = await Token.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload token");
        }

        this.data = reloaded.data;
    }

    public static async fromId(id: string | null): Promise<Token | null> {
        if (!id) {
            return null;
        }

        return await Token.fromSql(eq(Tokens.id, id));
    }

    public static async fromIds(ids: string[]): Promise<Token[]> {
        return await Token.manyFromSql(inArray(Tokens.id, ids));
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Tokens.id),
    ): Promise<Token | null> {
        const found = await db.query.Tokens.findFirst({
            where: sql,
            orderBy,
            with: {
                application: true,
            },
        });

        if (!found) {
            return null;
        }
        return new Token(found);
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Tokens.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Tokens.findMany>[0],
    ): Promise<Token[]> {
        const found = await db.query.Tokens.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: {
                application: true,
                ...extra?.with,
            },
        });

        return found.map((s) => new Token(s));
    }

    public async update(newAttachment: Partial<TokenType>): Promise<TokenType> {
        await db
            .update(Tokens)
            .set(newAttachment)
            .where(eq(Tokens.id, this.id));

        const updated = await Token.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update token");
        }

        this.data = updated.data;
        return updated.data;
    }

    public save(): Promise<TokenType> {
        return this.update(this.data);
    }

    public async delete(ids?: string[]): Promise<void> {
        if (Array.isArray(ids)) {
            await db.delete(Tokens).where(inArray(Tokens.id, ids));
        } else {
            await db.delete(Tokens).where(eq(Tokens.id, this.id));
        }
    }

    public static async insert(
        data: InferInsertModel<typeof Tokens>,
    ): Promise<Token> {
        const inserted = (await db.insert(Tokens).values(data).returning())[0];

        const token = await Token.fromId(inserted.id);

        if (!token) {
            throw new Error("Failed to insert token");
        }

        return token;
    }

    public static async insertMany(
        data: InferInsertModel<typeof Tokens>[],
    ): Promise<Token[]> {
        const inserted = await db.insert(Tokens).values(data).returning();

        return await Token.fromIds(inserted.map((i) => i.id));
    }

    public get id(): string {
        return this.data.id;
    }

    public static async fromAccessToken(
        accessToken: string,
    ): Promise<Token | null> {
        return await Token.fromSql(eq(Tokens.accessToken, accessToken));
    }

    /**
     * Retrieves the associated user from this token
     *
     * @returns The user associated with this token
     */
    public async getUser(): Promise<User | null> {
        if (!this.data.userId) {
            return null;
        }

        return await User.fromId(this.data.userId);
    }

    public toApi(): ApiToken {
        return {
            access_token: this.data.accessToken,
            token_type: "Bearer",
            scope: this.data.scope,
            created_at: Math.floor(
                new Date(this.data.createdAt).getTime() / 1000,
            ),
        };
    }
}