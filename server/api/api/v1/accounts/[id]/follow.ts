import { parseRequest } from "@request";
import { errorResponse, jsonResponse } from "@response";
import { MatchedRoute } from "bun";
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
	route: "/accounts/:id/follow",
	auth: {
		required: true,
	},
});

/**
 * Follow a user
 */
export default async (
	req: Request,
	matchedRoute: MatchedRoute
): Promise<Response> => {
	const id = matchedRoute.params.id;

	const { user: self } = await getFromRequest(req);

	if (!self) return errorResponse("Unauthorized", 401);

	const { languages, notify, reblogs } = await parseRequest<{
		reblogs?: boolean;
		notify?: boolean;
		languages?: string[];
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

	if (!relationship.following) {
		relationship.following = true;
	}
	if (reblogs) {
		relationship.showingReblogs = true;
	}
	if (notify) {
		relationship.notifying = true;
	}
	if (languages) {
		relationship.languages = languages;
	}

	await client.relationship.update({
		where: { id: relationship.id },
		data: {
			following: true,
			showingReblogs: reblogs ?? false,
			notifying: notify ?? false,
			languages: languages ?? [],
		},
	});

	return jsonResponse(await relationshipToAPI(relationship));
};
