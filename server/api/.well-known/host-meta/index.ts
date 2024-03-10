import { xmlResponse } from "@response";
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
	route: "/.well-known/host-meta",
});


export default apiRoute(async (req, matchedRoute, extraData) => {
	const config = await extraData.configManager.getConfig();
	
	return xmlResponse(`
<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
	<Link rel="lrdd" template="${config.http.base_url}/.well-known/webfinger?resource={uri}"/>
</XRD>
	`);
});
