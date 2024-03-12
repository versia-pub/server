import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	auth: {
		required: false,
	},
	ratelimits: {
		duration: 60,
		max: 10,
	},
	route: "/oauth/providers",
});

/**
 * Lists available OAuth providers
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
	const config = await extraData.configManager.getConfig();

	return jsonResponse(
		config.oidc.providers.map(p => ({
			name: p.name,
			icon: p.icon,
			id: p.id,
		}))
	);
});
