import { jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { User } from "~database/entities/User";

export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const user = await User.findOneBy({
		id,
	});

	if (!user)
		return jsonResponse(
			{
				statusText: "User not found",
			},
			404
		);

	return jsonResponse({
		id,
	});
};
