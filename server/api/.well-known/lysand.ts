import { jsonResponse } from "@response";
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
	route: "/.well-known/lysand",
});

export default apiRoute(async (req, matchedRoute, extraData) => {
    const config = await extraData.configManager.getConfig();

	// In the format acct:name@example.com
    return jsonResponse({
        type: "ServerMetadata",
        name: config.instance.name,
        version: "0.0.1",
        description: config.instance.description,
        logo: config.instance.logo ? [
            {
                content: config.instance.logo,
                content_type: `image/${config.instance.logo.split(".")[1]}`,
            }
        ] : undefined,
        banner: config.instance.banner ? [
            {
                content: config.instance.banner,
                content_type: `image/${config.instance.banner.split(".")[1]}`,
            }
        ] : undefined,
        supported_extensions: [
            "org.lysand:custom_emojis"
        ],
        website: "https://lysand.org",
        // TODO: Add admins, moderators field
    })
})
