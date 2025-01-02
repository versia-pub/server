import { z } from "@hono/zod-openapi";
import type {
    Alerts,
    PushSubscription as ApiPushSubscription,
} from "@versia/client/types";
import { type Token, type User, db } from "@versia/kit/db";
import { PushSubscriptions, Users } from "@versia/kit/tables";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import { BaseInterface } from "./base.ts";

type PushSubscriptionType = InferSelectModel<typeof PushSubscriptions>;

export class PushSubscription extends BaseInterface<
    typeof PushSubscriptions,
    PushSubscriptionType
> {
    public static schema = z.object({
        id: z.string().uuid().openapi({
            example: "24eb1891-accc-43b4-b213-478e37d525b4",
            description: "The ID of the Web Push subscription in the database.",
        }),
        endpoint: z.string().url().openapi({
            example: "https://yourdomain.example/listener",
            description: "Where push alerts will be sent to.",
        }),
        alerts: z
            .object({
                mention: z.boolean().optional().openapi({
                    example: true,
                    description: "Receive mention notifications?",
                }),
                favourite: z.boolean().optional().openapi({
                    example: true,
                    description: "Receive favourite notifications?",
                }),
                reblog: z.boolean().optional().openapi({
                    example: true,
                    description: "Receive reblog notifications?",
                }),
                follow: z.boolean().optional().openapi({
                    example: true,
                    description: "Receive follow notifications?",
                }),
                poll: z.boolean().optional().openapi({
                    example: false,
                    description: "Receive poll notifications?",
                }),
                follow_request: z.boolean().optional().openapi({
                    example: false,
                    description: "Receive follow request notifications?",
                }),
                status: z.boolean().optional().openapi({
                    example: false,
                    description:
                        "Receive new subscribed account notifications?",
                }),
                update: z.boolean().optional().openapi({
                    example: false,
                    description: "Receive status edited notifications?",
                }),
                "admin.sign_up": z.boolean().optional().openapi({
                    example: false,
                    description:
                        "Receive new user signup notifications? Must have a role with the appropriate permissions.",
                }),
                "admin.report": z.boolean().optional().openapi({
                    example: false,
                    description:
                        "Receive new report notifications? Must have a role with the appropriate permissions.",
                }),
            })
            .default({})
            .openapi({
                example: {
                    mention: true,
                    favourite: true,
                    reblog: true,
                    follow: true,
                    poll: false,
                    follow_request: false,
                    status: false,
                    update: false,
                    "admin.sign_up": false,
                    "admin.report": false,
                },
                description:
                    "Which alerts should be delivered to the endpoint.",
            }),
        server_key: z.string().openapi({
            example:
                "BCk-QqERU0q-CfYZjcuB6lnyyOYfJ2AifKqfeGIm7Z-HiTU5T9eTG5GxVA0_OH5mMlI4UkkDTpaZwozy0TzdZ2M=",
            description: "The streaming server’s VAPID key.",
        }),
    });

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
        const found = await db.query.PushSubscriptions.findMany({
            where: (): SQL => eq(Users.id, user.id),
            limit,
            offset,
            with: {
                token: {
                    with: {
                        user: true,
                    },
                },
            },
        });

        return found.map((s) => new PushSubscription(s));
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

    public getAlerts(): Alerts {
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

    public toApi(): ApiPushSubscription {
        return {
            id: this.data.id,
            alerts: this.getAlerts(),
            endpoint: this.data.endpoint,
            // FIXME: Add real key
            server_key: "",
        };
    }
}
