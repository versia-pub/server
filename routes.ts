import type { RouteHandler } from "./server/api/routes.type";
import type { APIRouteMeta } from "./types/api";

// Why are these routes specified manually instead of using Bun's FileSystemRouter?
// This is to allow for compilation of the routes, so that we can minify them and
// node_modules in production
export const rawRoutes = {
	"/api/v1/accounts": await import("./server/api/api/v1/accounts"),
	"/api/v1/accounts/familiar_followers": await import(
		"./server/api/api/v1/accounts/familiar_followers/index"
	),
	"/api/v1/accounts/relationships": await import(
		"./server/api/api/v1/accounts/relationships/index"
	),
	"/api/v1/accounts/search": await import(
		"./server/api/api/v1/accounts/search/index"
	),
	"/api/v1/accounts/update_credentials": await import(
		"./server/api/api/v1/accounts/update_credentials/index"
	),
	"/api/v1/accounts/verify_credentials": await import(
		"./server/api/api/v1/accounts/verify_credentials/index"
	),
	"/api/v1/apps": await import("./server/api/api/v1/apps/index"),
	"/api/v1/apps/verify_credentials": await import(
		"./server/api/api/v1/apps/verify_credentials/index"
	),
	"/api/v1/blocks": await import("./server/api/api/v1/blocks/index"),
	"/api/v1/custom_emojis": await import(
		"./server/api/api/v1/custom_emojis/index"
	),
	"/api/v1/favourites": await import("./server/api/api/v1/favourites/index"),
	"/api/v1/follow_requests": await import(
		"./server/api/api/v1/follow_requests/index"
	),
	"/api/v1/instance": await import("./server/api/api/v1/instance/index"),
	"/api/v1/media": await import("./server/api/api/v1/media/index"),
	"/api/v1/mutes": await import("./server/api/api/v1/mutes/index"),
	"/api/v1/notifications": await import(
		"./server/api/api/v1/notifications/index"
	),
	"/api/v1/profile/avatar": await import(
		"./server/api/api/v1/profile/avatar"
	),
	"/api/v1/profile/header": await import(
		"./server/api/api/v1/profile/header"
	),
	"/api/v1/statuses": await import("./server/api/api/v1/statuses/index"),
	"/api/v1/timelines/home": await import(
		"./server/api/api/v1/timelines/home"
	),
	"/api/v1/timelines/public": await import(
		"./server/api/api/v1/timelines/public"
	),
	"/api/v2/media": await import("./server/api/api/v2/media/index"),
	"/api/v2/search": await import("./server/api/api/v2/search/index"),
	"/auth/login": await import("./server/api/auth/login/index"),
	"/nodeinfo/2.0": await import("./server/api/nodeinfo/2.0/index"),
	"/oauth/authorize-external": await import(
		"./server/api/oauth/authorize-external/index"
	),
	"/oauth/providers": await import("./server/api/oauth/providers/index"),
	"/oauth/token": await import("./server/api/oauth/token/index"),
	"/api/v1/accounts/[id]": await import(
		"./server/api/api/v1/accounts/[id]/index"
	),
	"/api/v1/accounts/[id]/block": await import(
		"./server/api/api/v1/accounts/[id]/block"
	),
	"/api/v1/accounts/[id]/follow": await import(
		"./server/api/api/v1/accounts/[id]/follow"
	),
	"/api/v1/accounts/[id]/followers": await import(
		"./server/api/api/v1/accounts/[id]/followers"
	),
	"/api/v1/accounts/[id]/following": await import(
		"./server/api/api/v1/accounts/[id]/following"
	),
	"/api/v1/accounts/[id]/mute": await import(
		"./server/api/api/v1/accounts/[id]/mute"
	),
	"/api/v1/accounts/[id]/note": await import(
		"./server/api/api/v1/accounts/[id]/note"
	),
	"/api/v1/accounts/[id]/pin": await import(
		"./server/api/api/v1/accounts/[id]/pin"
	),
	"/api/v1/accounts/[id]/remove_from_followers": await import(
		"./server/api/api/v1/accounts/[id]/remove_from_followers"
	),
	"/api/v1/accounts/[id]/statuses": await import(
		"./server/api/api/v1/accounts/[id]/statuses"
	),
	"/api/v1/accounts/[id]/unblock": await import(
		"./server/api/api/v1/accounts/[id]/unblock"
	),
	"/api/v1/accounts/[id]/unfollow": await import(
		"./server/api/api/v1/accounts/[id]/unfollow"
	),
	"/api/v1/accounts/[id]/unmute": await import(
		"./server/api/api/v1/accounts/[id]/unmute"
	),
	"/api/v1/accounts/[id]/unpin": await import(
		"./server/api/api/v1/accounts/[id]/unpin"
	),
	"/api/v1/follow_requests/[account_id]/authorize": await import(
		"./server/api/api/v1/follow_requests/[account_id]/authorize"
	),
	"/api/v1/follow_requests/[account_id]/reject": await import(
		"./server/api/api/v1/follow_requests/[account_id]/reject"
	),
	"/api/v1/media/[id]": await import("./server/api/api/v1/media/[id]/index"),
	"/api/v1/statuses/[id]": await import(
		"./server/api/api/v1/statuses/[id]/index"
	),
	"/api/v1/statuses/[id]/context": await import(
		"./server/api/api/v1/statuses/[id]/context"
	),
	"/api/v1/statuses/[id]/favourite": await import(
		"./server/api/api/v1/statuses/[id]/favourite"
	),
	"/api/v1/statuses/[id]/favourited_by": await import(
		"./server/api/api/v1/statuses/[id]/favourited_by"
	),
	"/api/v1/statuses/[id]/pin": await import(
		"./server/api/api/v1/statuses/[id]/pin"
	),
	"/api/v1/statuses/[id]/reblog": await import(
		"./server/api/api/v1/statuses/[id]/reblog"
	),
	"/api/v1/statuses/[id]/reblogged_by": await import(
		"./server/api/api/v1/statuses/[id]/reblogged_by"
	),
	"/api/v1/statuses/[id]/source": await import(
		"./server/api/api/v1/statuses/[id]/source"
	),
	"/api/v1/statuses/[id]/unfavourite": await import(
		"./server/api/api/v1/statuses/[id]/unfavourite"
	),
	"/api/v1/statuses/[id]/unpin": await import(
		"./server/api/api/v1/statuses/[id]/unpin"
	),
	"/api/v1/statuses/[id]/unreblog": await import(
		"./server/api/api/v1/statuses/[id]/unreblog"
	),
	"/media/[id]": await import("./server/api/media/[id]/index"),
	"/oauth/callback/[issuer]": await import(
		"./server/api/oauth/callback/[issuer]/index"
	),
	"/object/[uuid]": await import("./server/api/object/[uuid]/index"),
	"/users/[uuid]": await import("./server/api/users/[uuid]/index"),
	"/users/[uuid]/inbox": await import(
		"./server/api/users/[uuid]/inbox/index"
	),
	"/users/[uuid]/outbox": await import(
		"./server/api/users/[uuid]/outbox/index"
	),
	"/[...404]": await import("./server/api/[...404]"),
};

// Returns the route filesystem path when given a URL
export const routeMatcher = new Bun.FileSystemRouter({
	style: "nextjs",
	dir: process.cwd() + "/server/api",
});

export const matchRoute = <T = Record<string, never>>(url: string) => {
	const route = routeMatcher.match(url);
	if (!route) return { file: null, matchedRoute: null };

	return {
		// @ts-expect-error TypeScript parses this as a defined object instead of an arbitrarily editable route file
		file: rawRoutes[route.name] as Promise<
			| {
					meta: APIRouteMeta;
					default: RouteHandler<T>;
			  }
			| undefined
		>,
		matchedRoute: route,
	};
};
