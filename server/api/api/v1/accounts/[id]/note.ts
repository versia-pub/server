import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { Relationship } from "~database/entities/Relationship";
import { User, userRelations } from "~database/entities/User";
import { applyConfig } from "@api";

export const meta = applyConfig({
	allowedMethods: ["POST"],
	ratelimits: {
		max: 30,
		duration: 60,
	},
	route: "/accounts/:id/note",
	auth: {
		required: true,
	},
});

/**
 * Sets a user note
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const { user: self } = await User.getFromRequest(req);

	if (!self) return errorResponse("Unauthorized", 401);

	const { comment } = await parseRequest<{
		comment: string;
	}>(req);

	const user = await User.findOne({
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

	relationship.note = comment ?? "";

	await relationship.save();
	return jsonResponse(await relationship.toAPI());
};
