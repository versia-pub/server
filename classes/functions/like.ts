import type { Like } from "@lysand-org/federation/types";
import { type InferSelectModel, and, eq } from "drizzle-orm";
import { db } from "~/drizzle/db";
import { Likes, Notifications } from "~/drizzle/schema";
import { config } from "~/packages/config-manager/index";
import type { Note } from "~/packages/database-interface/note";
import type { User } from "~/packages/database-interface/user";

export type LikeType = InferSelectModel<typeof Likes>;

/**
 * Represents a Like entity in the database.
 */
export const likeToLysand = (like: LikeType): Like => {
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
 * @param note Status being liked
 */
export const createLike = async (user: User, note: Note) => {
    await db.insert(Likes).values({
        likedId: note.id,
        likerId: user.id,
    });

    if (note.author.data.instanceId === user.data.instanceId) {
        // Notify the user that their post has been favourited
        await db.insert(Notifications).values({
            accountId: user.id,
            type: "favourite",
            notifiedId: note.author.id,
            noteId: note.id,
        });
    } else {
        // TODO: Add database jobs for federating this
    }
};

/**
 * Delete a like
 * @param user User deleting their like
 * @param note Status being unliked
 */
export const deleteLike = async (user: User, note: Note) => {
    await db
        .delete(Likes)
        .where(and(eq(Likes.likedId, note.id), eq(Likes.likerId, user.id)));

    // Notify the user that their post has been favourited
    await db
        .delete(Notifications)
        .where(
            and(
                eq(Notifications.accountId, user.id),
                eq(Notifications.type, "favourite"),
                eq(Notifications.notifiedId, note.author.id),
                eq(Notifications.noteId, note.id),
            ),
        );

    if (user.isLocal() && note.author.isRemote()) {
        // User is local, federate the delete
        // TODO: Federate this
    }
};
