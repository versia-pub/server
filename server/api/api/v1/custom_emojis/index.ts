import { apiRoute, applyConfig } from "@api";
import { jsonResponse } from "@response";
import { client } from "~database/datasource";
import { emojiToAPI } from "~database/entities/Emoji";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/api/v1/custom_emojis",
	ratelimits: {
		max: 100,
		duration: 60,
	},
	auth: {
		required: false,
	},
});

export default apiRoute(async () => {
	const emojis = await client.emoji.findMany({
		where: {
			instanceId: null,
		},
	});

	return jsonResponse(
		await Promise.all(emojis.map(emoji => emojiToAPI(emoji)))
	);
});
