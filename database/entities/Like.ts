import { config } from "config-manager";
import { type InferSelectModel, and, eq } from "drizzle-orm";
import type * as Lysand from "lysand-types";
import { db } from "~drizzle/db";
import { Likes, Notifications } from "~drizzle/schema";
import type { StatusWithRelations } from "./Status";
import type { UserWithRelations } from "./User";

export type Like = InferSelectModel<typeof Likes>;

/**
 * Represents a Like entity in the database.
 */
export const likeToLysand = (like: Like): Lysand.Like => {
    return {
        id: like.id,
        // biome-ignore lint/suspicious/noExplicitAny: to be rewritten
        author: (like as any).liker?.uri,
        type: "Like",
        created_at: new Date(like.createdAt).toISOString(),
        // biome-ignore lint/suspicious/noExplicitAny: to be rewritten
        object: (like as any).liked?.uri,
        uri: new URL(`/objects/${like.id}`, config.http.base_url).toString(),
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
    await db.insert(Likes).values({
        likedId: status.id,
        likerId: user.id,
    });

    if (status.author.instanceId === user.instanceId) {
        // Notify the user that their post has been favourited
        await db.insert(Notifications).values({
            accountId: user.id,
            type: "favourite",
            notifiedId: status.authorId,
            noteId: status.id,
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
        .delete(Likes)
        .where(and(eq(Likes.likedId, status.id), eq(Likes.likerId, user.id)));

    // Notify the user that their post has been favourited
    await db
        .delete(Notifications)
        .where(
            and(
                eq(Notifications.accountId, user.id),
                eq(Notifications.type, "favourite"),
                eq(Notifications.notifiedId, status.authorId),
                eq(Notifications.noteId, status.id),
            ),
        );

    if (user.instanceId === null && status.author.instanceId !== null) {
        // User is local, federate the delete
        // TODO: Federate this
    }
};
