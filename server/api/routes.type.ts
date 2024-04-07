import type { MatchedRoute } from "bun";
import type { Config } from "config-manager";
import type { AuthData } from "~database/entities/User";

export type RouteHandler<T> = (
	req: Request,
	matchedRoute: MatchedRoute,
	extraData: {
		auth: AuthData;
		parsedRequest: Partial<T>;
		configManager: {
			getConfig: () => Promise<Config>;
		};
	}
) => Response | Promise<Response>;
