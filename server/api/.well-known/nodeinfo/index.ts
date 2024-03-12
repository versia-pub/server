import { apiRoute, applyConfig } from "@api";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	auth: {
		required: false,
	},
	ratelimits: {
		duration: 60,
		max: 60,
	},
	route: "/.well-known/nodeinfo",
});


export default apiRoute(async (req, matchedRoute, extraData) => {
	const config = await extraData.configManager.getConfig();

	return new Response("", {
		status: 301,
		headers: {
			Location: `${config.http.base_url}/.well-known/nodeinfo/2.0`,
		},
	});
});
