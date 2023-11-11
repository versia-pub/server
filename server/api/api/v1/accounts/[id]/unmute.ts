import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { Relationship } from "~database/entities/Relationship";
import { UserAction, userRelations } from "~database/entities/User";
import { applyConfig } from "@api";

export const meta = applyConfig({
	allowedMethods: ["POST"],
	ratelimits: {
		max: 30,
		duration: 60,
	},
	route: "/accounts/:id/unmute",
	auth: {
		required: true,
	},
});

/**
 * Unmute a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const { user: self } = await UserAction.getFromRequest(req);

	if (!self) return errorResponse("Unauthorized", 401);

	const user = await UserAction.findOne({
		where: {
			id,
		},
		relations: userRelations,
	});

	if (!user) return errorResponse("User not found", 404);

	// Check if already following
	let relationship = await self.getRelationshipToOtherUser(user);

	if (!relationship) {
		// Create new relationship

		const newRelationship = await Relationship.createNew(self, user);

		self.relationships.push(newRelationship);
		await self.save();

		relationship = newRelationship;
	}

	if (relationship.muting) {
		relationship.muting = false;
	}

	// TODO: Implement duration

	await relationship.save();
	return jsonResponse(await relationship.toAPI());
};
