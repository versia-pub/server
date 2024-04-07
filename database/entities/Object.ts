/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { LysandObject } from "@prisma/client";
import { client } from "~database/datasource";
import type { LysandObjectType } from "~types/lysand/Object";

/**
 * Represents a Lysand object in the database.
 */

export const createFromObject = async (object: LysandObjectType) => {
    const foundObject = await client.lysandObject.findFirst({
        where: { remote_id: object.id },
        include: {
            author: true,
        },
    });

    if (foundObject) {
        return foundObject;
    }

    const author = await client.lysandObject.findFirst({
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        where: { uri: (object as any).author },
    });

    return await client.lysandObject.create({
        data: {
            authorId: author?.id,
            created_at: new Date(object.created_at).toISOString(),
            extensions: object.extensions || {},
            remote_id: object.id,
            type: object.type,
            uri: object.uri,
            // Rest of data (remove id, author, created_at, extensions, type, uri)
            extra_data: Object.fromEntries(
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
        },
    });
};

export const toLysand = (lyObject: LysandObject): LysandObjectType => {
    return {
        id: lyObject.remote_id || lyObject.id,
        created_at: new Date(lyObject.created_at).toISOString(),
        type: lyObject.type,
        uri: lyObject.uri,
        ...lyObject.extra_data,
        extensions: lyObject.extensions,
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
