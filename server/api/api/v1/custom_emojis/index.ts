import { applyConfig } from "@api";
import { jsonResponse } from "@response";
import { IsNull } from "typeorm";
import { EmojiAction } from "~database/entities/Emoji";

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

/**
 * S
 */
// eslint-disable-next-line @typescript-eslint/require-await
export default async (): Promise<Response> => {
	const emojis = await EmojiAction.findBy({
		instance: IsNull(),
	});

	return jsonResponse(
		await Promise.all(emojis.map(async emoji => await emoji.toAPI()))
	);
};
