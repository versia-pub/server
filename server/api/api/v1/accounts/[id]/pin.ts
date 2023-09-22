import { getUserByToken } from "@auth";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { Relationship } from "~database/entities/Relationship";
import { User } from "~database/entities/User";

/**
 * Pin a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	// Check auth token
	const token = req.headers.get("Authorization")?.split(" ")[1] || null;

	if (!token)
		return errorResponse("This method requires an authenticated user", 422);

	const self = await getUserByToken(token);

	if (!self) return errorResponse("Unauthorized", 401);

	const user = await User.findOneBy({
		id,
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

	if (!relationship.endorsed) {
		relationship.endorsed = true;
	}

	await relationship.save();
	return jsonResponse(await relationship.toAPI());
};
