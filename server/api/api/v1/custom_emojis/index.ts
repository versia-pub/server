import { jsonResponse } from "@response";
import { IsNull } from "typeorm";
import { Emoji } from "~database/entities/Emoji";

/**
 * Creates a new user
 */
// eslint-disable-next-line @typescript-eslint/require-await
export default async (): Promise<Response> => {
	const emojis = await Emoji.findBy({
		instance: IsNull(),
	});

	return jsonResponse(
		await Promise.all(emojis.map(async emoji => await emoji.toAPI()))
	);
};
