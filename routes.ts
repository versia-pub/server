import type { RouteHandler } from "~server/api/routes.type";
import type { APIRouteMeta } from "~types/api";

const serverPath = process.cwd() + "/server/api";

// Why are these routes specified manually instead of using Bun's FileSystemRouter?
// This is to allow for compilation of the routes, so that we can minify them and
// node_modules in production
export const rawRoutes = {
	"/api/v1/accounts": await import(serverPath + "/api/v1/accounts/index.ts"),
	"/api/v1/accounts/familiar_followers": await import(
		serverPath + "/api/v1/accounts/familiar_followers/index.ts"
	),
	"/api/v1/accounts/relationships": await import(
		serverPath + "/api/v1/accounts/relationships/index.ts"
	),
	"/api/v1/accounts/search": await import(
		serverPath + "/api/v1/accounts/search/index.ts"
	),
	"/api/v1/accounts/update_credentials": await import(
		serverPath + "/api/v1/accounts/update_credentials/index.ts"
	),
	"/api/v1/accounts/verify_credentials": await import(
		serverPath + "/api/v1/accounts/verify_credentials/index.ts"
	),
	"/api/v1/apps": await import(serverPath + "/api/v1/apps/index.ts"),
	"/api/v1/apps/verify_credentials": await import(
		serverPath + "/api/v1/apps/verify_credentials/index.ts"
	),
	"/api/v1/blocks": await import(serverPath + "/api/v1/blocks/index.ts"),
	"/api/v1/custom_emojis": await import(
		serverPath + "/api/v1/custom_emojis/index.ts"
	),
	"/api/v1/favourites": await import(
		serverPath + "/api/v1/favourites/index.ts"
	),
	"/api/v1/follow_requests": await import(
		serverPath + "/api/v1/follow_requests/index.ts"
	),
	"/api/v1/instance": await import(serverPath + "/api/v1/instance/index.ts"),
	"/api/v1/media": await import(serverPath + "/api/v1/media/index.ts"),
	"/api/v1/mutes": await import(serverPath + "/api/v1/mutes/index.ts"),
	"/api/v1/notifications": await import(
		serverPath + "/api/v1/notifications/index.ts"
	),
	"/api/v1/profile/avatar": await import(
		serverPath + "/api/v1/profile/avatar.ts"
	),
	"/api/v1/profile/header": await import(
		serverPath + "/api/v1/profile/header.ts"
	),
	"/api/v1/statuses": await import(serverPath + "/api/v1/statuses/index.ts"),
	"/api/v1/timelines/home": await import(
		serverPath + "/api/v1/timelines/home.ts"
	),
	"/api/v1/timelines/public": await import(
		serverPath + "/api/v1/timelines/public.ts"
	),
	"/api/v2/media": await import(serverPath + "/api/v2/media/index.ts"),
	"/api/v2/search": await import(serverPath + "/api/v2/search/index.ts"),
	"/auth/login": await import(serverPath + "/auth/login/index.ts"),
	"/nodeinfo/2.0": await import(serverPath + "/nodeinfo/2.0/index.ts"),
	"/oauth/authorize-external": await import(
		serverPath + "/oauth/authorize-external/index.ts"
	),
	"/oauth/providers": await import(serverPath + "/oauth/providers/index.ts"),
	"/oauth/token": await import(serverPath + "/oauth/token/index.ts"),
	"/api/v1/accounts/[id]": await import(
		serverPath + "/api/v1/accounts/[id]/index.ts"
	),
	"/api/v1/accounts/[id]/block": await import(
		serverPath + "/api/v1/accounts/[id]/block.ts"
	),
	"/api/v1/accounts/[id]/follow": await import(
		serverPath + "/api/v1/accounts/[id]/follow.ts"
	),
	"/api/v1/accounts/[id]/followers": await import(
		serverPath + "/api/v1/accounts/[id]/followers.ts"
	),
	"/api/v1/accounts/[id]/following": await import(
		serverPath + "/api/v1/accounts/[id]/following.ts"
	),
	"/api/v1/accounts/[id]/mute": await import(
		serverPath + "/api/v1/accounts/[id]/mute.ts"
	),
	"/api/v1/accounts/[id]/note": await import(
		serverPath + "/api/v1/accounts/[id]/note.ts"
	),
	"/api/v1/accounts/[id]/pin": await import(
		serverPath + "/api/v1/accounts/[id]/pin.ts"
	),
	"/api/v1/accounts/[id]/remove_from_followers": await import(
		serverPath + "/api/v1/accounts/[id]/remove_from_followers.ts"
	),
	"/api/v1/accounts/[id]/statuses": await import(
		serverPath + "/api/v1/accounts/[id]/statuses.ts"
	),
	"/api/v1/accounts/[id]/unblock": await import(
		serverPath + "/api/v1/accounts/[id]/unblock.ts"
	),
	"/api/v1/accounts/[id]/unfollow": await import(
		serverPath + "/api/v1/accounts/[id]/unfollow.ts"
	),
	"/api/v1/accounts/[id]/unmute": await import(
		serverPath + "/api/v1/accounts/[id]/unmute.ts"
	),
	"/api/v1/accounts/[id]/unpin": await import(
		serverPath + "/api/v1/accounts/[id]/unpin.ts"
	),
	"/api/v1/follow_requests/[account_id]/authorize": await import(
		serverPath + "/api/v1/follow_requests/[account_id]/authorize.ts"
	),
	"/api/v1/follow_requests/[account_id]/reject": await import(
		serverPath + "/api/v1/follow_requests/[account_id]/reject.ts"
	),
	"/api/v1/media/[id]": await import(
		serverPath + "/api/v1/media/[id]/index.ts"
	),
	"/api/v1/statuses/[id]": await import(
		serverPath + "/api/v1/statuses/[id]/index.ts"
	),
	"/api/v1/statuses/[id]/context": await import(
		serverPath + "/api/v1/statuses/[id]/context.ts"
	),
	"/api/v1/statuses/[id]/favourite": await import(
		serverPath + "/api/v1/statuses/[id]/favourite.ts"
	),
	"/api/v1/statuses/[id]/favourited_by": await import(
		serverPath + "/api/v1/statuses/[id]/favourited_by.ts"
	),
	"/api/v1/statuses/[id]/pin": await import(
		serverPath + "/api/v1/statuses/[id]/pin.ts"
	),
	"/api/v1/statuses/[id]/reblog": await import(
		serverPath + "/api/v1/statuses/[id]/reblog.ts"
	),
	"/api/v1/statuses/[id]/reblogged_by": await import(
		serverPath + "/api/v1/statuses/[id]/reblogged_by.ts"
	),
	"/api/v1/statuses/[id]/source": await import(
		serverPath + "/api/v1/statuses/[id]/source.ts"
	),
	"/api/v1/statuses/[id]/unfavourite": await import(
		serverPath + "/api/v1/statuses/[id]/unfavourite.ts"
	),
	"/api/v1/statuses/[id]/unpin": await import(
		serverPath + "/api/v1/statuses/[id]/unpin.ts"
	),
	"/api/v1/statuses/[id]/unreblog": await import(
		serverPath + "/api/v1/statuses/[id]/unreblog.ts"
	),
	"/media/[id]": await import(serverPath + "/media/[id]/index.ts"),
	"/oauth/callback/[issuer]": await import(
		serverPath + "/oauth/callback/[issuer]/index.ts"
	),
	"/object/[uuid]": await import(serverPath + "/object/[uuid]/index.ts"),
	"/users/[uuid]": await import(serverPath + "/users/[uuid]/index.ts"),
	"/users/[uuid]/inbox": await import(
		serverPath + "/users/[uuid]/inbox/index.ts"
	),
	"/users/[uuid]/outbox": await import(
		serverPath + "/users/[uuid]/outbox/index.ts"
	),
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
		file: rawRoutes[route.name] as Promise<{
			meta: APIRouteMeta;
			default: RouteHandler<T>;
		}>,
		matchedRoute: route,
	};
};
