import type { InferSelectModel } from "drizzle-orm";
import { db } from "~drizzle/db";
import { lysandObject } from "~drizzle/schema";
import { findFirstUser } from "./User";
import type * as Lysand from "lysand-types";

export type LysandObject = InferSelectModel<typeof lysandObject>;

/**
 * Represents a Lysand object in the database.
 */

export const createFromObject = async (
    object: Lysand.Entity,
    authorUri: string,
) => {
    const foundObject = await db.query.lysandObject.findFirst({
        where: (o, { eq }) => eq(o.remoteId, object.id),
        with: {
            author: true,
        },
    });

    if (foundObject) {
        return foundObject;
    }

    const author = await findFirstUser({
        where: (user, { eq }) => eq(user.uri, authorUri),
    });

    return await db.insert(lysandObject).values({
        authorId: author?.id,
        createdAt: new Date(object.created_at).toISOString(),
        extensions: object.extensions,
        remoteId: object.id,
        type: object.type,
        uri: object.uri,
        // Rest of data (remove id, author, created_at, extensions, type, uri)
        extraData: Object.fromEntries(
            Object.entries(object).filter(
                ([key]) =>
                    ![
                        "id",
                        "author",
                        "created_at",
                        "extensions",
                        "type",
                        "uri",
                    ].includes(key),
            ),
        ),
    });
};

export const toLysand = (lyObject: LysandObject): Lysand.Entity => {
    return {
        id: lyObject.remoteId || lyObject.id,
        created_at: new Date(lyObject.createdAt).toISOString(),
        type: lyObject.type,
        uri: lyObject.uri,
        ...(lyObject.extraData as object),
        // @ts-expect-error Assume stored JSON is valid
        extensions: lyObject.extensions as object,
    };
};

export const isPublication = (lyObject: LysandObject): boolean => {
    return lyObject.type === "Note" || lyObject.type === "Patch";
};

export const isAction = (lyObject: LysandObject): boolean => {
    return [
        "Like",
        "Follow",
        "Dislike",
        "FollowAccept",
        "FollowReject",
        "Undo",
        "Announce",
    ].includes(lyObject.type);
};

export const isActor = (lyObject: LysandObject): boolean => {
    return lyObject.type === "User";
};

export const isExtension = (lyObject: LysandObject): boolean => {
    return lyObject.type === "Extension";
};
