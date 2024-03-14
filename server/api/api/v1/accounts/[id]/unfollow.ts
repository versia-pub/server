import { errorResponse, jsonResponse } from "@response";
import {
	createNewRelationship,
	relationshipToAPI,
} from "~database/entities/Relationship";
import { getRelationshipToOtherUser } from "~database/entities/User";
import { apiRoute, applyConfig } from "@api";
import { client } from "~database/datasource";

export const meta = applyConfig({
	allowedMethods: ["POST"],
	ratelimits: {
		max: 30,
		duration: 60,
	},
	route: "/accounts/:id/unfollow",
	auth: {
		required: true,
		oauthPermissions: ["write:follows"],
	},
});

/**
 * Unfollows a user
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
	const id = matchedRoute.params.id;

	const { user: self } = extraData.auth;

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

	if (relationship.following) {
		relationship.following = false;
	}

	await client.relationship.update({
		where: { id: relationship.id },
		data: {
			following: false,
		},
	});

	return jsonResponse(relationshipToAPI(relationship));
});
