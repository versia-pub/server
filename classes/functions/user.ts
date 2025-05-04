import {
    type Application,
    db,
    type Emoji,
    type Instance,
    type Media,
    type Role,
    type Token,
    type User,
} from "@versia/kit/db";
import type { Users } from "@versia/kit/tables";
import type { InferSelectModel } from "drizzle-orm";

export const userRelations = {
    instance: true,
    emojis: {
        with: {
            emoji: {
                with: {
                    instance: true,
                    media: true,
                },
            },
        },
    },
    avatar: true,
    header: true,
    roles: {
        with: {
            role: true,
        },
    },
} as const;

export interface AuthData {
    user: User | null;
    token: Token | null;
    application: Application | null;
}

export const transformOutputToUserWithRelations = (
    user: Omit<InferSelectModel<typeof Users>, "endpoints"> & {
        followerCount: unknown;
        followingCount: unknown;
        statusCount: unknown;
        avatar: typeof Media.$type | null;
        header: typeof Media.$type | null;
        emojis: {
            userId: string;
            emojiId: string;
            emoji?: typeof Emoji.$type;
        }[];
        instance: typeof Instance.$type | null;
        roles: {
            userId: string;
            roleId: string;
            role?: typeof Role.$type;
        }[];
        endpoints: unknown;
    },
): typeof User.$type => {
    return {
        ...user,
        followerCount: Number(user.followerCount),
        followingCount: Number(user.followingCount),
        statusCount: Number(user.statusCount),
        endpoints:
            user.endpoints ??
            ({} as Partial<{
                dislikes: string;
                featured: string;
                likes: string;
                followers: string;
                following: string;
                inbox: string;
                outbox: string;
            }>),
        emojis: user.emojis.map(
            (emoji) =>
                (emoji as unknown as Record<string, object>)
                    .emoji as typeof Emoji.$type,
        ),
        roles: user.roles
            .map((role) => role.role)
            .filter(Boolean) as (typeof Role.$type)[],
    };
};

export const findManyUsers = async (
    query: Parameters<typeof db.query.Users.findMany>[0],
): Promise<(typeof User.$type)[]> => {
    const output = await db.query.Users.findMany({
        ...query,
        with: {
            ...userRelations,
            ...query?.with,
        },
    });

    return output.map((user) => transformOutputToUserWithRelations(user));
};
