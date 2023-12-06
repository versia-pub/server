import { applyConfig } from "@api";
import { getConfig } from "@config";
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
// eslint-disable-next-line @typescript-eslint/require-await
export default async (): Promise<Response> => {
	const config = getConfig();

	return jsonResponse(
		config.oidc.providers.map(p => ({
			name: p.name,
			icon: p.icon,
			id: p.id,
		}))
	);
};
