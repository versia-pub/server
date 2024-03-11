import type { MatchedRoute } from "bun";
import type { ConfigManager } from "config-manager";
import type { AuthData } from "~database/entities/User";

export type RouteHandler<T> = (
	req: Request,
	matchedRoute: MatchedRoute,
	extraData: {
		auth: AuthData;
		parsedRequest: Partial<T>;
		configManager: ConfigManager;
	}
) => Response | Promise<Response>;
