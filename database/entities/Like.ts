import { config } from "config-manager";
import type { StatusWithRelations } from "./Status";
import type { UserWithRelations } from "./User";
import type * as Lysand from "lysand-types";
import { and, eq, type InferSelectModel } from "drizzle-orm";
import { notification, like } from "~drizzle/schema";
import { db } from "~drizzle/db";

export type Like = InferSelectModel<typeof like>;

/**
 * Represents a Like entity in the database.
 */
export const toLysand = (like: Like): Lysand.Like => {
    return {
        id: like.id,
        // biome-ignore lint/suspicious/noExplicitAny: to be rewritten
        author: (like as any).liker?.uri,
        type: "Like",
        created_at: new Date(like.createdAt).toISOString(),
        // biome-ignore lint/suspicious/noExplicitAny: to be rewritten
        object: (like as any).liked?.uri,
        uri: new URL(
            `/objects/like/${like.id}`,
            config.http.base_url,
        ).toString(),
    };
};

/**
 * Create a like
 * @param user User liking the status
 * @param status Status being liked
 */
export const createLike = async (
    user: UserWithRelations,
    status: StatusWithRelations,
) => {
    await db.insert(like).values({
        likedId: status.id,
        likerId: user.id,
    });

    if (status.author.instanceId === user.instanceId) {
        // Notify the user that their post has been favourited
        await db.insert(notification).values({
            accountId: user.id,
            type: "favourite",
            notifiedId: status.authorId,
            statusId: status.id,
        });
    } else {
        // TODO: Add database jobs for federating this
    }
};

/**
 * Delete a like
 * @param user User deleting their like
 * @param status Status being unliked
 */
export const deleteLike = async (
    user: UserWithRelations,
    status: StatusWithRelations,
) => {
    await db
        .delete(like)
        .where(and(eq(like.likedId, status.id), eq(like.likerId, user.id)));

    // Notify the user that their post has been favourited
    await db
        .delete(notification)
        .where(
            and(
                eq(notification.accountId, user.id),
                eq(notification.type, "favourite"),
                eq(notification.notifiedId, status.authorId),
                eq(notification.statusId, status.id),
            ),
        );

    if (user.instanceId === null && status.author.instanceId !== null) {
        // User is local, federate the delete
        // TODO: Federate this
    }
};
