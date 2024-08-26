import type { Unfollow } from "@versia/federation/types";
import type { User } from "~/packages/database-interface/user";

export const unfollowFederationRequest = (
    unfollower: User,
    unfollowing: User,
): Unfollow => {
    const id = crypto.randomUUID();
    return {
        type: "Unfollow",
        id,
        author: unfollower.getUri(),
        created_at: new Date().toISOString(),
        followee: unfollowing.getUri(),
    };
};
