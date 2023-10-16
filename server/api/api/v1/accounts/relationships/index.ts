import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { Relationship } from "~database/entities/Relationship";
import { User } from "~database/entities/User";
import { applyConfig } from "@api";

export const meta = applyConfig({
	allowedMethods: ["GET"],
	route: "/api/v1/accounts/relationships",
	ratelimits: {
		max: 30,
		duration: 60,
	},
	auth: {
		required: true,
	},
});

/**
 * Find relationships
 */
export default async (req: Request): Promise<Response> => {
	const { user: self } = await User.getFromRequest(req);

	if (!self) return errorResponse("Unauthorized", 401);

	const { "id[]": ids } = await parseRequest<{
		"id[]": string[];
	}>(req);

	// Minimum id count 1, maximum 10
	if (!ids || ids.length < 1 || ids.length > 10) {
		return errorResponse("Number of ids must be between 1 and 10", 422);
	}

	// Check if already following
	// TODO: Limit ID amount
	const relationships = (
		await Promise.all(
			ids.map(async id => {
				const user = await User.findOneBy({ id });
				if (!user) return null;
				let relationship = await self.getRelationshipToOtherUser(user);

				if (!relationship) {
					// Create new relationship

					const newRelationship = await Relationship.createNew(
						self,
						user
					);

					self.relationships.push(newRelationship);
					await self.save();

					relationship = newRelationship;
				}
				return relationship;
			})
		)
	).filter(relationship => relationship !== null) as Relationship[];

	return jsonResponse(
		await Promise.all(relationships.map(async r => await r.toAPI()))
	);
};
