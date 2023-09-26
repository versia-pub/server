import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { Relationship } from "~database/entities/Relationship";
import { User } from "~database/entities/User";

/**
 * Sets a user note
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

	const self = await User.retrieveFromToken(token);

	if (!self) return errorResponse("Unauthorized", 401);

	const { comment } = await parseRequest<{
		comment: string;
	}>(req);

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

	relationship.note = comment ?? "";

	// TODO: Implement duration

	await relationship.save();
	return jsonResponse(await relationship.toAPI());
};
