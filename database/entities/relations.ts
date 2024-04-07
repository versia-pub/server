import type { Prisma } from "@prisma/client";

export const userRelations: Prisma.UserInclude = {
    emojis: true,
    instance: true,
    likes: true,
    relationships: true,
    relationshipSubjects: true,
    pinnedNotes: true,
    _count: {
        select: {
            statuses: true,
            likes: true,
        },
    },
};

export const statusAndUserRelations: Prisma.StatusInclude = {
    author: {
        include: userRelations,
    },
    application: true,
    emojis: true,
    inReplyToPost: {
        include: {
            author: {
                include: userRelations,
            },
            application: true,
            emojis: true,
            inReplyToPost: {
                include: {
                    author: true,
                },
            },
            instance: true,
            mentions: true,
            pinnedBy: true,
            _count: {
                select: {
                    replies: true,
                },
            },
        },
    },
    reblogs: true,
    attachments: true,
    instance: true,
    mentions: {
        include: userRelations,
    },
    pinnedBy: true,
    _count: {
        select: {
            replies: true,
            likes: true,
            reblogs: true,
        },
    },
    reblog: {
        include: {
            author: {
                include: userRelations,
            },
            application: true,
            emojis: true,
            inReplyToPost: {
                include: {
                    author: true,
                },
            },
            instance: true,
            mentions: {
                include: userRelations,
            },
            pinnedBy: true,
            _count: {
                select: {
                    replies: true,
                },
            },
        },
    },
    quotingPost: {
        include: {
            author: {
                include: userRelations,
            },
            application: true,
            emojis: true,
            inReplyToPost: {
                include: {
                    author: true,
                },
            },
            instance: true,
            mentions: true,
            pinnedBy: true,
            _count: {
                select: {
                    replies: true,
                },
            },
        },
    },
    likes: {
        include: {
            liker: true,
        },
    },
};
