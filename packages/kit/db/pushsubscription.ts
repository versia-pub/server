import type { WebPushSubscription as WebPushSubscriptionSchema } from "@versia/client/schemas";
import {
    desc,
    eq,
    type InferInsertModel,
    type InferSelectModel,
    inArray,
    type SQL,
} from "drizzle-orm";
import type { z } from "zod";
import { db } from "../tables/db.ts";
import { PushSubscriptions, Tokens } from "../tables/schema.ts";
import { BaseInterface } from "./base.ts";
import type { Token } from "./token.ts";
import type { User } from "./user.ts";

type PushSubscriptionType = InferSelectModel<typeof PushSubscriptions>;

export class PushSubscription extends BaseInterface<
    typeof PushSubscriptions,
    PushSubscriptionType
> {
    public static $type: PushSubscriptionType;

    public async reload(): Promise<void> {
        const reloaded = await PushSubscription.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload subscription");
        }

        this.data = reloaded.data;
    }

    public static async fromId(
        id: string | null,
    ): Promise<PushSubscription | null> {
        if (!id) {
            return null;
        }

        return await PushSubscription.fromSql(eq(PushSubscriptions.id, id));
    }

    public static async fromIds(ids: string[]): Promise<PushSubscription[]> {
        return await PushSubscription.manyFromSql(
            inArray(PushSubscriptions.id, ids),
        );
    }

    public static async fromToken(
        token: Token,
    ): Promise<PushSubscription | null> {
        return await PushSubscription.fromSql(
            eq(PushSubscriptions.tokenId, token.id),
        );
    }

    public static async manyFromUser(
        user: User,
        limit?: number,
        offset?: number,
    ): Promise<PushSubscription[]> {
        const found = await db
            .select()
            .from(PushSubscriptions)
            .leftJoin(Tokens, eq(Tokens.id, PushSubscriptions.tokenId))
            .where(eq(Tokens.userId, user.id))
            .limit(limit ?? 9e10)
            .offset(offset ?? 0);

        return found.map((s) => new PushSubscription(s.PushSubscriptions));
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(PushSubscriptions.id),
    ): Promise<PushSubscription | null> {
        const found = await db.query.PushSubscriptions.findFirst({
            where: sql,
            orderBy,
        });

        if (!found) {
            return null;
        }
        return new PushSubscription(found);
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(PushSubscriptions.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.PushSubscriptions.findMany>[0],
    ): Promise<PushSubscription[]> {
        const found = await db.query.PushSubscriptions.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: extra?.with,
        });

        return found.map((s) => new PushSubscription(s));
    }

    public async update(
        newSubscription: Partial<PushSubscriptionType>,
    ): Promise<PushSubscriptionType> {
        await db
            .update(PushSubscriptions)
            .set(newSubscription)
            .where(eq(PushSubscriptions.id, this.id));

        const updated = await PushSubscription.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update subscription");
        }

        this.data = updated.data;
        return updated.data;
    }

    public save(): Promise<PushSubscriptionType> {
        return this.update(this.data);
    }

    public static async clearAllOfToken(token: Token): Promise<void> {
        await db
            .delete(PushSubscriptions)
            .where(eq(PushSubscriptions.tokenId, token.id));
    }

    public async delete(ids?: string[]): Promise<void> {
        if (Array.isArray(ids)) {
            await db
                .delete(PushSubscriptions)
                .where(inArray(PushSubscriptions.id, ids));
        } else {
            await db
                .delete(PushSubscriptions)
                .where(eq(PushSubscriptions.id, this.id));
        }
    }

    public static async insert(
        data: InferInsertModel<typeof PushSubscriptions>,
    ): Promise<PushSubscription> {
        const inserted = (
            await db.insert(PushSubscriptions).values(data).returning()
        )[0];

        const subscription = await PushSubscription.fromId(inserted.id);

        if (!subscription) {
            throw new Error("Failed to insert subscription");
        }

        return subscription;
    }

    public get id(): string {
        return this.data.id;
    }

    public getAlerts(): z.infer<typeof WebPushSubscriptionSchema.shape.alerts> {
        return {
            mention: this.data.alerts.mention ?? false,
            favourite: this.data.alerts.favourite ?? false,
            reblog: this.data.alerts.reblog ?? false,
            follow: this.data.alerts.follow ?? false,
            poll: this.data.alerts.poll ?? false,
            follow_request: this.data.alerts.follow_request ?? false,
            status: this.data.alerts.status ?? false,
            update: this.data.alerts.update ?? false,
            "admin.sign_up": this.data.alerts["admin.sign_up"] ?? false,
            "admin.report": this.data.alerts["admin.report"] ?? false,
        };
    }

    public toApi(): z.infer<typeof WebPushSubscriptionSchema> {
        return {
            id: this.data.id,
            alerts: this.getAlerts(),
            endpoint: this.data.endpoint,
            // FIXME: Add real key
            server_key: "",
        };
    }
}
