import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { User, userRelations } from "~database/entities/User";
import { applyConfig } from "@api";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	ratelimits: {
		max: 30,
		duration: 60,
	},
	route: "/accounts/:id",
	auth: {
		required: true,
	},
});

/**
 * Fetch a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const { user } = await User.getFromRequest(req);

	let foundUser: User | null;
	try {
		foundUser = await User.findOne({
			where: {
				id,
			},
			relations: userRelations,
		});
	} catch (e) {
		return errorResponse("Invalid ID", 404);
	}

	if (!foundUser) return errorResponse("User not found", 404);

	return jsonResponse(await foundUser.toAPI(user?.id === foundUser.id));
};
