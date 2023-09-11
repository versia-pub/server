import { jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { DBUser } from "~database/entities/DBUser";

export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const user = await DBUser.findOneBy({
		id,
	});

	if (!user)
		return jsonResponse(
			{
				error: "User not found",
			},
			404
		);

	return jsonResponse(user.toAPI());
};
