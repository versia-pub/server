// Why are these routes specified manually instead of using Bun's FileSystemRouter?
// This is to allow for compilation of the routes, so that we can minify them and
// node_modules in production
export const rawRoutes = {
    "/api/v1/accounts": "./server/api/api/v1/accounts",
    "/api/v1/accounts/familiar_followers":
        "+api/v1/accounts/familiar_followers/index",
    "/api/v1/accounts/relationships":
        "./server/api/api/v1/accounts/relationships/index",
    "/api/v1/accounts/search": "./server/api/api/v1/accounts/search/index",
    "/api/v1/accounts/update_credentials":
        "./server/api/api/v1/accounts/update_credentials/index",
    "/api/v1/accounts/verify_credentials":
        "./server/api/api/v1/accounts/verify_credentials/index",
    "/api/v1/apps": "./server/api/api/v1/apps/index",
    "/api/v1/apps/verify_credentials":
        "./server/api/api/v1/apps/verify_credentials/index",
    "/api/v1/blocks": "./server/api/api/v1/blocks/index",
    "/api/v1/custom_emojis": "./server/api/api/v1/custom_emojis/index",
    "/api/v1/favourites": "./server/api/api/v1/favourites/index",
    "/api/v1/follow_requests": "./server/api/api/v1/follow_requests/index",
    "/api/v1/instance": "./server/api/api/v1/instance/index",
    "/api/v1/media": "./server/api/api/v1/media/index",
    "/api/v1/mutes": "./server/api/api/v1/mutes/index",
    "/api/v1/notifications": "./server/api/api/v1/notifications/index",
    "/api/v1/profile/avatar": "./server/api/api/v1/profile/avatar",
    "/api/v1/profile/header": "./server/api/api/v1/profile/header",
    "/api/v1/statuses": "./server/api/api/v1/statuses/index",
    "/api/v1/timelines/home": "./server/api/api/v1/timelines/home",
    "/api/v1/timelines/public": "./server/api/api/v1/timelines/public",
    "/api/v2/media": "./server/api/api/v2/media/index",
    "/api/v2/search": "./server/api/api/v2/search/index",
    "/api/auth/login": "./server/api/api/auth/login/index",
    "/api/auth/redirect": "./server/api/api/auth/redirect/index",
    "/nodeinfo/2.0": "./server/api/nodeinfo/2.0/index",
    "/oauth/authorize-external": "./server/api/oauth/authorize-external/index",
    "/oauth/providers": "./server/api/oauth/providers/index",
    "/oauth/token": "./server/api/oauth/token/index",
    "/api/v1/accounts/[id]": "./server/api/api/v1/accounts/[id]/index",
    "/api/v1/accounts/[id]/block": "./server/api/api/v1/accounts/[id]/block",
    "/api/v1/accounts/[id]/follow": "./server/api/api/v1/accounts/[id]/follow",
    "/api/v1/accounts/[id]/followers":
        "./server/api/api/v1/accounts/[id]/followers",
    "/api/v1/accounts/[id]/following":
        "./server/api/api/v1/accounts/[id]/following",
    "/api/v1/accounts/[id]/mute": "./server/api/api/v1/accounts/[id]/mute",
    "/api/v1/accounts/[id]/note": "./server/api/api/v1/accounts/[id]/note",
    "/api/v1/accounts/[id]/pin": "./server/api/api/v1/accounts/[id]/pin",
    "/api/v1/accounts/[id]/remove_from_followers":
        "./server/api/api/v1/accounts/[id]/remove_from_followers",
    "/api/v1/accounts/[id]/statuses":
        "./server/api/api/v1/accounts/[id]/statuses",
    "/api/v1/accounts/[id]/unblock":
        "./server/api/api/v1/accounts/[id]/unblock",
    "/api/v1/accounts/[id]/unfollow":
        "./server/api/api/v1/accounts/[id]/unfollow",
    "/api/v1/accounts/[id]/unmute": "./server/api/api/v1/accounts/[id]/unmute",
    "/api/v1/accounts/[id]/unpin": "./server/api/api/v1/accounts/[id]/unpin",
    "/api/v1/accounts/lookup": "./server/api/api/v1/accounts/lookup/index",
    "/api/v1/follow_requests/[account_id]/authorize":
        "./server/api/api/v1/follow_requests/[account_id]/authorize",
    "/api/v1/follow_requests/[account_id]/reject":
        "./server/api/api/v1/follow_requests/[account_id]/reject",
    "/api/v1/media/[id]": "./server/api/api/v1/media/[id]/index",
    "/api/v1/statuses/[id]": "./server/api/api/v1/statuses/[id]/index",
    "/api/v1/statuses/[id]/context":
        "./server/api/api/v1/statuses/[id]/context",
    "/api/v1/statuses/[id]/favourite":
        "./server/api/api/v1/statuses/[id]/favourite",
    "/api/v1/statuses/[id]/favourited_by":
        "./server/api/api/v1/statuses/[id]/favourited_by",
    "/api/v1/statuses/[id]/pin": "./server/api/api/v1/statuses/[id]/pin",
    "/api/v1/statuses/[id]/reblog": "./server/api/api/v1/statuses/[id]/reblog",
    "/api/v1/statuses/[id]/reblogged_by":
        "./server/api/api/v1/statuses/[id]/reblogged_by",
    "/api/v1/statuses/[id]/source": "./server/api/api/v1/statuses/[id]/source",
    "/api/v1/statuses/[id]/unfavourite":
        "./server/api/api/v1/statuses/[id]/unfavourite",
    "/api/v1/statuses/[id]/unpin": "./server/api/api/v1/statuses/[id]/unpin",
    "/api/v1/statuses/[id]/unreblog":
        "./server/api/api/v1/statuses/[id]/unreblog",
    "/api/_fe/config": "./server/api/api/_fe/config/index",
    "/media/[id]": "./server/api/media/[id]/index",
    "/oauth/callback/[issuer]": "./server/api/oauth/callback/[issuer]/index",
    "/objects/note/[uuid]": "./server/api/objects/note/[uuid]/index",
    "/users/[uuid]": "./server/api/users/[uuid]/index",
    "/users/[uuid]/inbox": "./server/api/users/[uuid]/inbox/index",
    "/users/[uuid]/outbox": "./server/api/users/[uuid]/outbox/index",
    // .well-known queries are automatically re-routed to well-known
    "/well-known/webfinger": "./server/api/well-known/webfinger/index",
    "/well-known/host-meta": "./server/api/well-known/host-meta/index",
    "/well-known/lysand": "./server/api/well-known/lysand",
    "/[...404]": "./server/api/[...404]",
} as Record<string, string>;

// Returns the route filesystem path when given a URL
export const routeMatcher = new Bun.FileSystemRouter({
    style: "nextjs",
    dir: `${process.cwd()}/server/api`,
});

export const matchRoute = async (url: string) => {
    const route = routeMatcher.match(url);
    if (!route) return { file: null, matchedRoute: null };

    return {
        matchedRoute: route,
    };
};
