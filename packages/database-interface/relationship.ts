import type { Relationship as APIRelationship } from "@versia/client/types";
import {
    type InferInsertModel,
    type InferSelectModel,
    type SQL,
    and,
    desc,
    eq,
    inArray,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { Relationships } from "~/drizzle/schema";
import { BaseInterface } from "./base";
import type { User } from "./user";

export type RelationshipType = InferSelectModel<typeof Relationships>;

export type RelationshipWithOpposite = RelationshipType & {
    followedBy: boolean;
    blockedBy: boolean;
    requestedBy: boolean;
};

export class Relationship extends BaseInterface<
    typeof Relationships,
    RelationshipWithOpposite
> {
    static schema = z.object({
        id: z.string(),
        blocked_by: z.boolean(),
        blocking: z.boolean(),
        domain_blocking: z.boolean(),
        endorsed: z.boolean(),
        followed_by: z.boolean(),
        following: z.boolean(),
        muting_notifications: z.boolean(),
        muting: z.boolean(),
        note: z.string().nullable(),
        notifying: z.boolean(),
        requested_by: z.boolean(),
        requested: z.boolean(),
        showing_reblogs: z.boolean(),
    });

    async reload(): Promise<void> {
        const reloaded = await Relationship.fromId(this.data.id);

        if (!reloaded) {
            throw new Error("Failed to reload relationship");
        }

        this.data = reloaded.data;
    }

    public static async fromId(
        id: string | null,
    ): Promise<Relationship | null> {
        if (!id) {
            return null;
        }

        return await Relationship.fromSql(eq(Relationships.id, id));
    }

    public static async fromIds(ids: string[]): Promise<Relationship[]> {
        return await Relationship.manyFromSql(inArray(Relationships.id, ids));
    }

    public static async fromOwnerAndSubject(
        owner: User,
        subject: User,
    ): Promise<Relationship> {
        const found = await Relationship.fromSql(
            and(
                eq(Relationships.ownerId, owner.id),
                eq(Relationships.subjectId, subject.id),
            ),
        );

        if (!found) {
            // Create a new relationship if one doesn't exist
            return await Relationship.insert({
                ownerId: owner.id,
                subjectId: subject.id,
                languages: [],
                following: false,
                showingReblogs: false,
                notifying: false,
                blocking: false,
                muting: false,
                mutingNotifications: false,
                requested: false,
                domainBlocking: false,
                endorsed: false,
                note: "",
            });
        }

        return found;
    }

    public static async fromOwnerAndSubjects(
        owner: User,
        subjectIds: string[],
    ): Promise<Relationship[]> {
        const found = await Relationship.manyFromSql(
            and(
                eq(Relationships.ownerId, owner.id),
                inArray(Relationships.subjectId, subjectIds),
            ),
        );

        const missingSubjectsIds = subjectIds.filter(
            (id) => !found.find((rel) => rel.data.subjectId === id),
        );

        for (const subjectId of missingSubjectsIds) {
            await Relationship.insert({
                ownerId: owner.id,
                subjectId: subjectId,
                languages: [],
                following: false,
                showingReblogs: false,
                notifying: false,
                blocking: false,
                muting: false,
                mutingNotifications: false,
                requested: false,
                domainBlocking: false,
                endorsed: false,
                note: "",
            });
        }

        return await Relationship.manyFromSql(
            and(
                eq(Relationships.ownerId, owner.id),
                inArray(Relationships.subjectId, subjectIds),
            ),
        );
    }

    public static async fromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Relationships.id),
    ): Promise<Relationship | null> {
        const found = await db.query.Relationships.findFirst({
            where: sql,
            orderBy,
        });

        if (!found) {
            return null;
        }

        const opposite = await Relationship.getOpposite(found);

        return new Relationship({
            ...found,
            followedBy: opposite.following,
            blockedBy: opposite.blocking,
            requestedBy: opposite.requested,
        });
    }

    public static async manyFromSql(
        sql: SQL<unknown> | undefined,
        orderBy: SQL<unknown> | undefined = desc(Relationships.id),
        limit?: number,
        offset?: number,
        extra?: Parameters<typeof db.query.Relationships.findMany>[0],
    ): Promise<Relationship[]> {
        const found = await db.query.Relationships.findMany({
            where: sql,
            orderBy,
            limit,
            offset,
            with: extra?.with,
        });

        const opposites = await Promise.all(
            found.map((rel) => Relationship.getOpposite(rel)),
        );

        return found.map((s, i) => {
            return new Relationship({
                ...s,
                followedBy: opposites[i].following,
                blockedBy: opposites[i].blocking,
                requestedBy: opposites[i].requested,
            });
        });
    }

    public static async getOpposite(oppositeTo: {
        subjectId: string;
        ownerId: string;
    }): Promise<RelationshipType> {
        let output = await db.query.Relationships.findFirst({
            where: (rel, { and, eq }) =>
                and(
                    eq(rel.ownerId, oppositeTo.subjectId),
                    eq(rel.subjectId, oppositeTo.ownerId),
                ),
        });

        // If the opposite relationship doesn't exist, create it
        if (!output) {
            output = (
                await db
                    .insert(Relationships)
                    .values({
                        ownerId: oppositeTo.subjectId,
                        subjectId: oppositeTo.ownerId,
                        languages: [],
                        following: false,
                        showingReblogs: false,
                        notifying: false,
                        blocking: false,
                        domainBlocking: false,
                        endorsed: false,
                        note: "",
                        muting: false,
                        mutingNotifications: false,
                        requested: false,
                    })
                    .returning()
            )[0];
        }

        return output;
    }

    async update(
        newRelationship: Partial<RelationshipType>,
    ): Promise<RelationshipWithOpposite> {
        await db
            .update(Relationships)
            .set(newRelationship)
            .where(eq(Relationships.id, this.id));

        const updated = await Relationship.fromId(this.data.id);

        if (!updated) {
            throw new Error("Failed to update relationship");
        }

        this.data = updated.data;
        return updated.data;
    }

    save(): Promise<RelationshipWithOpposite> {
        return this.update(this.data);
    }

    async delete(ids: string[]): Promise<void>;
    async delete(): Promise<void>;
    async delete(ids?: unknown): Promise<void> {
        if (Array.isArray(ids)) {
            await db
                .delete(Relationships)
                .where(inArray(Relationships.id, ids));
        } else {
            await db.delete(Relationships).where(eq(Relationships.id, this.id));
        }
    }

    public static async insert(
        data: InferInsertModel<typeof Relationships>,
    ): Promise<Relationship> {
        const inserted = (
            await db.insert(Relationships).values(data).returning()
        )[0];

        const relationship = await Relationship.fromId(inserted.id);

        if (!relationship) {
            throw new Error("Failed to insert relationship");
        }

        // Create opposite relationship if necessary
        await Relationship.getOpposite({
            subjectId: relationship.data.subjectId,
            ownerId: relationship.data.ownerId,
        });

        return relationship;
    }

    get id() {
        return this.data.id;
    }

    public toApi(): APIRelationship {
        return {
            id: this.data.subjectId,
            blocked_by: this.data.blockedBy,
            blocking: this.data.blocking,
            domain_blocking: this.data.domainBlocking,
            endorsed: this.data.endorsed,
            followed_by: this.data.followedBy,
            following: this.data.following,
            muting_notifications: this.data.mutingNotifications,
            muting: this.data.muting,
            note: this.data.note,
            notifying: this.data.notifying,
            requested_by: this.data.requestedBy,
            requested: this.data.requested,
            showing_reblogs: this.data.showingReblogs,
        };
    }
}
