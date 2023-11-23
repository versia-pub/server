import { parseRequest } from "@request";
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
	route: "/accounts/:id/mute",
	auth: {
		required: true,
	},
});

/**
 * Mute a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const { user: self } = await getFromRequest(req);

	if (!self) return errorResponse("Unauthorized", 401);

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { notifications, duration } = await parseRequest<{
		notifications: boolean;
		duration: number;
	}>(req);

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

	if (!relationship.muting) {
		relationship.muting = true;
	}
	if (notifications ?? true) {
		relationship.mutingNotifications = true;
	}

	await client.relationship.update({
		where: { id: relationship.id },
		data: {
			muting: true,
			mutingNotifications: notifications ?? true,
		},
	});

	// TODO: Implement duration

	return jsonResponse(relationshipToAPI(relationship));
};
