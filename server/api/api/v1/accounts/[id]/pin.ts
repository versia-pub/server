import { errorResponse, jsonResponse } from "@response";
import type { MatchedRoute } from "bun";
import {
	createNewRelationship,
	relationshipToAPI,
} from "~database/entities/Relationship";
import {
	getFromRequest,
	getRelationshipToOtherUser,
} from "~database/entities/User";
import { applyConfig } from "@api";
import { client } from "~database/datasource";

export const meta = applyConfig({
	allowedMethods: ["POST"],
	ratelimits: {
		max: 30,
		duration: 60,
	},
	route: "/accounts/:id/pin",
	auth: {
		required: true,
	},
});

/**
 * Pin a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const { user: self } = await getFromRequest(req);

	if (!self) return errorResponse("Unauthorized", 401);

	const user = await client.user.findUnique({
		where: { id },
		include: {
			relationships: {
				include: {
					owner: true,
					subject: true,
				},
			},
		},
	});

	if (!user) return errorResponse("User not found", 404);

	// Check if already following
	let relationship = await getRelationshipToOtherUser(self, user);

	if (!relationship) {
		// Create new relationship

		const newRelationship = await createNewRelationship(self, user);

		await client.user.update({
			where: { id: self.id },
			data: {
				relationships: {
					connect: {
						id: newRelationship.id,
					},
				},
			},
		});

		relationship = newRelationship;
	}

	if (!relationship.endorsed) {
		relationship.endorsed = true;
	}

	await client.relationship.update({
		where: { id: relationship.id },
		data: {
			endorsed: true,
		},
	});

	return jsonResponse(relationshipToAPI(relationship));
};
