import { getConfig } from "~classes/configmanager";
import type { APIRouteMeta } from "~types/api";

export const applyConfig = (routeMeta: APIRouteMeta) => {
	const config = getConfig();
	const newMeta = routeMeta;

	// Apply ratelimits from config
	newMeta.ratelimits.duration *= config.ratelimits.duration_coeff;
	newMeta.ratelimits.max *= config.ratelimits.max_coeff;

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (config.custom_ratelimits[routeMeta.route]) {
		newMeta.ratelimits = config.custom_ratelimits[routeMeta.route];
	}

	return newMeta;
};
