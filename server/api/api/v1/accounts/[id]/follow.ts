import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
import { Relationship } from "~database/entities/Relationship";
import { User } from "~database/entities/User";

/**
 * Follow a user
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

	const { languages, notify, reblogs } = await parseRequest<{
		reblogs?: boolean;
		notify?: boolean;
		languages?: string[];
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

	if (!relationship.following) {
		relationship.following = true;
	}
	if (reblogs) {
		relationship.showing_reblogs = true;
	}
	if (notify) {
		relationship.notifying = true;
	}
	if (languages) {
		relationship.languages = languages;
	}

	await relationship.save();
	return jsonResponse(await relationship.toAPI());
};
