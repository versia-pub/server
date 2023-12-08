import type { MatchedRoute } from "bun";
import type { AuthData } from "~database/entities/User";
import type { APIRouteMeta } from "~types/api";

const serverPath = process.cwd() + "/server/api";

// Why are these routes specified manually instead of using Bun's FileSystemRouter?
// This is to allow for compilation of the routes, so that we can minify them and
// node_modules in production
export const rawRoutes = {
	"/api/v1/accounts": import(serverPath + "/api/v1/accounts/index.ts"),
	"/api/v1/accounts/familiar_followers": import(
		serverPath + "/api/v1/accounts/familiar_followers/index.ts"
	),
	"/api/v1/accounts/relationships": import(
		serverPath + "/api/v1/accounts/relationships/index.ts"
	),
	"/api/v1/accounts/search": import(
		serverPath + "/api/v1/accounts/search/index.ts"
	),
	"/api/v1/accounts/update_credentials": import(
		serverPath + "/api/v1/accounts/update_credentials/index.ts"
	),
	"/api/v1/accounts/verify_credentials": import(
		serverPath + "/api/v1/accounts/verify_credentials/index.ts"
	),
	"/api/v1/apps": import(serverPath + "/api/v1/apps/index.ts"),
	"/api/v1/apps/verify_credentials": import(
		serverPath + "/api/v1/apps/verify_credentials/index.ts"
	),
	"/api/v1/blocks": import(serverPath + "/api/v1/blocks/index.ts"),
	"/api/v1/custom_emojis": import(
		serverPath + "/api/v1/custom_emojis/index.ts"
	),
	"/api/v1/favourites": import(serverPath + "/api/v1/favourites/index.ts"),
	"/api/v1/follow_requests": import(
		serverPath + "/api/v1/follow_requests/index.ts"
	),
	"/api/v1/instance": import(serverPath + "/api/v1/instance/index.ts"),
	"/api/v1/media": import(serverPath + "/api/v1/media/index.ts"),
	"/api/v1/mutes": import(serverPath + "/api/v1/mutes/index.ts"),
	"/api/v1/notifications": import(
		serverPath + "/api/v1/notifications/index.ts"
	),
	"/api/v1/profile/avatar": import(serverPath + "/api/v1/profile/avatar.ts"),
	"/api/v1/profile/header": import(serverPath + "/api/v1/profile/header.ts"),
	"/api/v1/statuses": import(serverPath + "/api/v1/statuses/index.ts"),
	"/api/v1/timelines/home": import(serverPath + "/api/v1/timelines/home.ts"),
	"/api/v1/timelines/public": import(
		serverPath + "/api/v1/timelines/public.ts"
	),
	"/api/v2/media": import(serverPath + "/api/v2/media/index.ts"),
	"/api/v2/search": import(serverPath + "/api/v2/search/index.ts"),
	"/auth/login": import(serverPath + "/auth/login/index.ts"),
	"/nodeinfo/2.0": import(serverPath + "/nodeinfo/2.0/index.ts"),
	"/oauth/authorize-external": import(
		serverPath + "/oauth/authorize-external/index.ts"
	),
	"/oauth/providers": import(serverPath + "/oauth/providers/index.ts"),
	"/oauth/token": import(serverPath + "/oauth/token/index.ts"),
	"/api/v1/accounts/[id]": import(
		serverPath + "/api/v1/accounts/[id]/index.ts"
	),
	"/api/v1/accounts/[id]/block": import(
		serverPath + "/api/v1/accounts/[id]/block.ts"
	),
	"/api/v1/accounts/[id]/follow": import(
		serverPath + "/api/v1/accounts/[id]/follow.ts"
	),
	"/api/v1/accounts/[id]/followers": import(
		serverPath + "/api/v1/accounts/[id]/followers.ts"
	),
	"/api/v1/accounts/[id]/following": import(
		serverPath + "/api/v1/accounts/[id]/following.ts"
	),
	"/api/v1/accounts/[id]/mute": import(
		serverPath + "/api/v1/accounts/[id]/mute.ts"
	),
	"/api/v1/accounts/[id]/note": import(
		serverPath + "/api/v1/accounts/[id]/note.ts"
	),
	"/api/v1/accounts/[id]/pin": import(
		serverPath + "/api/v1/accounts/[id]/pin.ts"
	),
	"/api/v1/accounts/[id]/remove_from_followers": import(
		serverPath + "/api/v1/accounts/[id]/remove_from_followers.ts"
	),
	"/api/v1/accounts/[id]/statuses": import(
		serverPath + "/api/v1/accounts/[id]/statuses.ts"
	),
	"/api/v1/accounts/[id]/unblock": import(
		serverPath + "/api/v1/accounts/[id]/unblock.ts"
	),
	"/api/v1/accounts/[id]/unfollow": import(
		serverPath + "/api/v1/accounts/[id]/unfollow.ts"
	),
	"/api/v1/accounts/[id]/unmute": import(
		serverPath + "/api/v1/accounts/[id]/unmute.ts"
	),
	"/api/v1/accounts/[id]/unpin": import(
		serverPath + "/api/v1/accounts/[id]/unpin.ts"
	),
	"/api/v1/follow_requests/[account_id]/authorize": import(
		serverPath + "/api/v1/follow_requests/[account_id]/authorize.ts"
	),
	"/api/v1/follow_requests/[account_id]/reject": import(
		serverPath + "/api/v1/follow_requests/[account_id]/reject.ts"
	),
	"/api/v1/media/[id]": import(serverPath + "/api/v1/media/[id]/index.ts"),
	"/api/v1/statuses/[id]": import(
		serverPath + "/api/v1/statuses/[id]/index.ts"
	),
	"/api/v1/statuses/[id]/context": import(
		serverPath + "/api/v1/statuses/[id]/context.ts"
	),
	"/api/v1/statuses/[id]/favourite": import(
		serverPath + "/api/v1/statuses/[id]/favourite.ts"
	),
	"/api/v1/statuses/[id]/favourited_by": import(
		serverPath + "/api/v1/statuses/[id]/favourited_by.ts"
	),
	"/api/v1/statuses/[id]/pin": import(
		serverPath + "/api/v1/statuses/[id]/pin.ts"
	),
	"/api/v1/statuses/[id]/reblog": import(
		serverPath + "/api/v1/statuses/[id]/reblog.ts"
	),
	"/api/v1/statuses/[id]/reblogged_by": import(
		serverPath + "/api/v1/statuses/[id]/reblogged_by.ts"
	),
	"/api/v1/statuses/[id]/source": import(
		serverPath + "/api/v1/statuses/[id]/source.ts"
	),
	"/api/v1/statuses/[id]/unfavourite": import(
		serverPath + "/api/v1/statuses/[id]/unfavourite.ts"
	),
	"/api/v1/statuses/[id]/unpin": import(
		serverPath + "/api/v1/statuses/[id]/unpin.ts"
	),
	"/api/v1/statuses/[id]/unreblog": import(
		serverPath + "/api/v1/statuses/[id]/unreblog.ts"
	),
	"/media/[id]": import(serverPath + "/media/[id]/index.ts"),
	"/oauth/callback/[issuer]": import(
		serverPath + "/oauth/callback/[issuer]/index.ts"
	),
	"/object/[uuid]": import(serverPath + "/object/[uuid]/index.ts"),
	"/users/[uuid]": import(serverPath + "/users/[uuid]/index.ts"),
	"/users/[uuid]/inbox": import(serverPath + "/users/[uuid]/inbox/index.ts"),
	"/users/[uuid]/outbox": import(
		serverPath + "/users/[uuid]/outbox/index.ts"
	),
};

// Returns the route filesystem path when given a URL
export const routeMatcher = new Bun.FileSystemRouter({
	style: "nextjs",
	dir: process.cwd() + "/server/api",
});

export const matchRoute = (url: string) => {
	const route = routeMatcher.match(url);
	if (!route) return { file: null, matchedRoute: null };

	return {
		// @ts-expect-error TypeScript parses this as a defined object instead of an arbitrarily editable route file
		file: rawRoutes[route.name] as Promise<{
			meta: APIRouteMeta;
			default: (
				req: Request,
				matchedRoute: MatchedRoute,
				auth: AuthData
			) => Response | Promise<Response>;
		}>,
		matchedRoute: route,
	};
};
